// Cloud sync engine for Kronos.
//
// Kronos is local-first (localStorage + IndexedDB, see storage.js). This module
// layers OPTIONAL cloud sync on top: when the user signs in, local data is
// reconciled with their Supabase rows and subsequent local changes are pushed
// up. Nothing here runs unless Supabase is configured AND a user is signed in.
//
// Design:
//  - Each syncable storage key maps 1:1 to a row in `sync_documents`
//    (user_id, workspace_id, doc_key, data jsonb). We mirror the raw stored
//    representation — localStorage values are stored as opaque strings, IDB
//    blobs as objects — so we never have to know each key's internal schema.
//  - Push: we piggyback on the existing storageEventSystem (which already
//    fires on every localStorage write and on the two IDB-backed keys). On a
//    change we mark the doc dirty and flush upserts after a short debounce.
//  - Pull: only on sign-in / app start (no realtime). reconcile() compares
//    cloud vs local per document and returns conflicts for the UI to resolve.
//
// Conflict policy (per the product decision): when both sides have content for
// the same document and they differ, we ASK the user which to keep. Documents
// present on only one side are copied to the other with no prompt.
import { supabase } from '../lib/supabase';
import { idbGet, idbSet } from './timesheetDB';
import {
  wsKeyFor,
  loadWorkspaces,
  saveWorkspaces,
  getActiveWorkspaceId,
  WORKSPACE_DEFAULT_ID,
} from './storage';
import storageEventSystem from './storageEvents';

const GLOBAL_WS = '__global__';
const DOCS_TABLE = 'sync_documents';
const WS_TABLE = 'workspaces';
const PUSH_DEBOUNCE_MS = 2000;

// ── Syncable key registry ──────────────────────────────────────────────────
// Workspace-scoped localStorage keys (mirrored as opaque strings).
const WS_LS_KEYS = [
  'kronos_selected_timezone',
  'kronos_week_start',
  'kronos_clock_format',
  'kronos_sort_order',
  'kronos_show_breaks',
  'kronos_invoice_settings',
  'kronos_daily_hour_goal',
  'kronos_weekend_days',
  'kronos_heatmap_colors',
  'kronos_goal_ring_colors',
  'kronos_date_format',
  // Deliberately excluded: kronos_selected_week (ephemeral "which week am I
  // viewing" UI state — syncing it across devices is more annoying than useful).
];
// Workspace-scoped IndexedDB keys (mirrored as objects).
const WS_IDB_KEYS = ['kronos_timesheet_data', 'kronos_weekly_timesheet'];
// Global (not per-workspace) localStorage keys. Only Pomodoro *settings* — the
// live timer runtime state (is_running, time_left, current_task, …) is
// intentionally never synced so a timer running on one device doesn't appear to
// run on another.
const GLOBAL_LS_KEYS = [
  'kronos_pomodoro_work_duration',
  'kronos_pomodoro_short_break_duration',
  'kronos_pomodoro_long_break_duration',
  'kronos_pomodoro_total_sets',
  'kronos_pomodoro_auto_start_breaks',
  'kronos_pomodoro_auto_start_work',
];

// Friendly labels for the conflict dialog, keyed by base doc key.
const DOC_LABELS = {
  kronos_timesheet_data: 'Time entries',
  kronos_weekly_timesheet: 'Weekly summary',
  kronos_invoice_settings: 'Invoice & billing settings',
  kronos_selected_timezone: 'Timezone',
  kronos_week_start: 'Week start',
  kronos_clock_format: 'Clock format',
  kronos_date_format: 'Date format',
  kronos_sort_order: 'Sort order',
  kronos_show_breaks: 'Show breaks',
  kronos_daily_hour_goal: 'Daily hour goal',
  kronos_weekend_days: 'Non-work days',
  kronos_heatmap_colors: 'Heatmap colors',
  kronos_goal_ring_colors: 'Goal ring colors',
  kronos_pomodoro_work_duration: 'Pomodoro: work length',
  kronos_pomodoro_short_break_duration: 'Pomodoro: short break',
  kronos_pomodoro_long_break_duration: 'Pomodoro: long break',
  kronos_pomodoro_total_sets: 'Pomodoro: sets',
  kronos_pomodoro_auto_start_breaks: 'Pomodoro: auto-start breaks',
  kronos_pomodoro_auto_start_work: 'Pomodoro: auto-start work',
};

// ── Module state ───────────────────────────────────────────────────────────
let _userId = null;
let _running = false;
let _applyingRemote = false; // suppress push while we write pulled data locally
const _dirty = new Set();    // docIds pending push
let _pushTimer = null;
let _pushWorkspaces = false;
const _unsubs = [];
let _onStatus = null;
const _status = { state: 'idle', lastError: null, lastSyncedAt: null };

const setStatus = (patch) => {
  Object.assign(_status, patch);
  if (_onStatus) _onStatus({ ..._status });
};

export const getStatus = () => ({ ..._status });
export const onStatus = (cb) => { _onStatus = cb; };

// ── Doc helpers ────────────────────────────────────────────────────────────
const docId = (wsId, baseKey) => `${wsId}::${baseKey}`;
const docLabel = (baseKey) => DOC_LABELS[baseKey] || baseKey;

// Resolve the on-disk key for a descriptor. Global keys live under their bare
// name; workspace-scoped keys are suffixed per workspace (default = bare).
const storageKeyFor = (wsId, baseKey) =>
  wsId === GLOBAL_WS ? baseKey : wsKeyFor(baseKey, wsId);

// Order-independent stringify so two IDB blobs that differ only in key order
// don't read as a conflict.
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
};

const readLocal = async (wsId, baseKey, kind) => {
  if (kind === 'idb') {
    const val = await idbGet(storageKeyFor(wsId, baseKey));
    return val ?? null;
  }
  try {
    return localStorage.getItem(storageKeyFor(wsId, baseKey));
  } catch {
    return null;
  }
};

const writeLocal = async (wsId, baseKey, kind, value) => {
  const key = storageKeyFor(wsId, baseKey);
  if (kind === 'idb') {
    await idbSet(key, value ?? {});
    return;
  }
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
};

// "Has meaningful content." null/absent for ls; empty object for idb both count
// as absent so a never-used key doesn't manufacture a conflict.
const isPresent = (kind, value) => {
  if (value == null) return false;
  if (kind === 'idb') return typeof value === 'object' && Object.keys(value).length > 0;
  return true;
};

const valuesEqual = (kind, a, b) =>
  kind === 'idb' ? stable(a) === stable(b) : a === b;

// Every (workspace, key) descriptor we care about, given the live workspace ids.
const allDescriptors = (workspaceIds) => {
  const descs = [];
  for (const wsId of workspaceIds) {
    for (const baseKey of WS_LS_KEYS) descs.push({ wsId, baseKey, kind: 'ls' });
    for (const baseKey of WS_IDB_KEYS) descs.push({ wsId, baseKey, kind: 'idb' });
  }
  for (const baseKey of GLOBAL_LS_KEYS) descs.push({ wsId: GLOBAL_WS, baseKey, kind: 'ls' });
  return descs;
};

// ── Cloud I/O ──────────────────────────────────────────────────────────────
const upsertDoc = async (wsId, baseKey, value) => {
  const { error } = await supabase.from(DOCS_TABLE).upsert(
    {
      user_id: _userId,
      workspace_id: wsId,
      doc_key: baseKey,
      data: value,
      updated_at: new Date().toISOString(),
      deleted: false,
    },
    { onConflict: 'user_id,workspace_id,doc_key' }
  );
  if (error) throw error;
};

const fetchAllDocs = async () => {
  const { data, error } = await supabase
    .from(DOCS_TABLE)
    .select('workspace_id, doc_key, data, deleted')
    .eq('user_id', _userId);
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    if (row.deleted) continue;
    map.set(docId(row.workspace_id, row.doc_key), row);
  }
  return map;
};

// ── Workspace list sync (auto-merge with tombstones, no prompt) ────────────
const fetchCloudWorkspaces = async () => {
  const { data, error } = await supabase
    .from(WS_TABLE)
    .select('id, name, deleted')
    .eq('user_id', _userId);
  if (error) throw error;
  return data || [];
};

// Merge local + cloud workspace lists. Cloud tombstones (deleted=true) win and
// remove the workspace locally; otherwise it's a union by id with local names
// preferred. Returns { merged, changedLocal }.
const mergeWorkspaces = (localList, cloudRows) => {
  const deleted = new Set(cloudRows.filter(r => r.deleted).map(r => r.id));
  const byId = new Map();
  for (const r of cloudRows) {
    if (r.deleted) continue;
    byId.set(r.id, { id: r.id, name: r.name });
  }
  for (const w of localList) {
    if (deleted.has(w.id)) continue; // honor a delete made on another device
    byId.set(w.id, { id: w.id, name: w.name }); // local name wins
  }
  let merged = [...byId.values()];
  if (merged.length === 0) merged = [{ id: WORKSPACE_DEFAULT_ID, name: 'Default workspace' }];
  const changedLocal = stable(merged) !== stable(localList);
  return { merged, changedLocal };
};

const pushWorkspaces = async () => {
  const local = loadWorkspaces();
  const cloud = await fetchCloudWorkspaces();
  const localIds = new Set(local.map(w => w.id));
  // Upsert every local workspace as live.
  for (const w of local) {
    const { error } = await supabase.from(WS_TABLE).upsert(
      { user_id: _userId, id: w.id, name: w.name, updated_at: new Date().toISOString(), deleted: false },
      { onConflict: 'user_id,id' }
    );
    if (error) throw error;
  }
  // Tombstone cloud workspaces that no longer exist locally.
  for (const r of cloud) {
    if (!r.deleted && !localIds.has(r.id)) {
      const { error } = await supabase.from(WS_TABLE)
        .update({ deleted: true, updated_at: new Date().toISOString() })
        .eq('user_id', _userId).eq('id', r.id);
      if (error) throw error;
    }
  }
};

// ── Reconcile (pull + classify) ────────────────────────────────────────────
// Returns { conflicts, changedLocal }. Applies all non-conflicting changes
// immediately; conflicts are returned for the UI to resolve via resolveConflicts.
export const reconcile = async () => {
  if (!supabase || !_userId) return { conflicts: [], changedLocal: false };
  setStatus({ state: 'syncing', lastError: null });
  try {
    // 1. Workspace list first — it defines which workspaces' docs to consider.
    const cloudWs = await fetchCloudWorkspaces();
    const { merged: mergedWs, changedLocal: wsChanged } = mergeWorkspaces(loadWorkspaces(), cloudWs);
    if (wsChanged) saveWorkspaces(mergedWs);
    await pushWorkspaces();

    // 2. Documents.
    const cloudDocs = await fetchAllDocs();
    const descs = allDescriptors(mergedWs.map(w => w.id));

    const conflicts = [];
    const pullList = [];
    const pushList = [];

    for (const d of descs) {
      const localVal = await readLocal(d.wsId, d.baseKey, d.kind);
      const cloudRow = cloudDocs.get(docId(d.wsId, d.baseKey));
      const localHas = isPresent(d.kind, localVal);
      const cloudHas = cloudRow != null && isPresent(d.kind, cloudRow.data);

      if (!localHas && !cloudHas) continue;
      if (localHas && !cloudHas) { pushList.push({ d, value: localVal }); continue; }
      if (!localHas && cloudHas) { pullList.push({ d, value: cloudRow.data }); continue; }
      if (valuesEqual(d.kind, localVal, cloudRow.data)) continue;
      conflicts.push({
        id: docId(d.wsId, d.baseKey),
        wsId: d.wsId,
        baseKey: d.baseKey,
        kind: d.kind,
        label: docLabel(d.baseKey),
        workspaceName: d.wsId === GLOBAL_WS
          ? null
          : (mergedWs.find(w => w.id === d.wsId)?.name ?? d.wsId),
        localValue: localVal,
        cloudValue: cloudRow.data,
      });
    }

    // Apply downloads (suppressing the push listener so we don't echo them back).
    _applyingRemote = true;
    try {
      for (const { d, value } of pullList) await writeLocal(d.wsId, d.baseKey, d.kind, value);
    } finally {
      _applyingRemote = false;
    }
    // Apply uploads.
    for (const { d, value } of pushList) await upsertDoc(d.wsId, d.baseKey, value);

    const changedLocal = wsChanged || pullList.length > 0;
    setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() });
    return { conflicts, changedLocal };
  } catch (err) {
    console.error('Sync reconcile failed:', err);
    setStatus({ state: 'error', lastError: err.message || String(err) });
    return { conflicts: [], changedLocal: false, error: err };
  }
};

// Resolve the conflicts reconcile() surfaced. `choices` maps conflict id ->
// 'local' | 'cloud'. Returns true if any local data changed (caller reloads).
export const resolveConflicts = async (conflicts, choices) => {
  if (!supabase || !_userId) return false;
  setStatus({ state: 'syncing', lastError: null });
  let changedLocal = false;
  try {
    _applyingRemote = true;
    for (const c of conflicts) {
      const pick = choices[c.id] || 'local';
      if (pick === 'cloud') {
        await writeLocal(c.wsId, c.baseKey, c.kind, c.cloudValue);
        changedLocal = true;
      } else {
        // Local wins — overwrite cloud so the two sides converge.
        await upsertDoc(c.wsId, c.baseKey, c.localValue);
      }
    }
    setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Conflict resolution failed:', err);
    setStatus({ state: 'error', lastError: err.message || String(err) });
  } finally {
    _applyingRemote = false;
  }
  return changedLocal;
};

// ── Push (on change) ───────────────────────────────────────────────────────
const scheduleFlush = () => {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(flush, PUSH_DEBOUNCE_MS);
};

const flush = async () => {
  _pushTimer = null;
  if (!supabase || !_userId) return;
  const batch = [..._dirty];
  _dirty.clear();
  const pushWs = _pushWorkspaces;
  _pushWorkspaces = false;
  if (batch.length === 0 && !pushWs) return;

  setStatus({ state: 'syncing', lastError: null });
  try {
    if (pushWs) await pushWorkspaces();
    for (const id of batch) {
      const [wsId, baseKey] = id.split('::');
      const kind = WS_IDB_KEYS.includes(baseKey) ? 'idb' : 'ls';
      const value = await readLocal(wsId, baseKey, kind);
      if (isPresent(kind, value)) await upsertDoc(wsId, baseKey, value);
    }
    setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Sync push failed:', err);
    // Re-queue so a transient failure retries on the next change.
    batch.forEach(id => _dirty.add(id));
    if (pushWs) _pushWorkspaces = true;
    setStatus({ state: 'error', lastError: err.message || String(err) });
  }
};

const markDirty = (wsId, baseKey) => {
  if (_applyingRemote) return;
  _dirty.add(docId(wsId, baseKey));
  scheduleFlush();
};

// Wire storageEventSystem subscriptions for the active workspace. Workspace
// switching reloads the app, so the active id is fixed for the engine's life.
const subscribePush = () => {
  const active = getActiveWorkspaceId();

  for (const baseKey of WS_LS_KEYS) {
    const lsKey = storageKeyFor(active, baseKey);
    _unsubs.push(storageEventSystem.subscribe(lsKey, () => markDirty(active, baseKey)));
  }
  // The two IDB keys emit under their BARE base key (see storage.js), not the
  // workspace-suffixed key — subscribe to the base.
  for (const baseKey of WS_IDB_KEYS) {
    _unsubs.push(storageEventSystem.subscribe(baseKey, () => markDirty(active, baseKey)));
  }
  for (const baseKey of GLOBAL_LS_KEYS) {
    _unsubs.push(storageEventSystem.subscribe(baseKey, () => markDirty(GLOBAL_WS, baseKey)));
  }
  _unsubs.push(storageEventSystem.subscribe('kronos_workspaces', () => {
    if (_applyingRemote) return;
    _pushWorkspaces = true;
    scheduleFlush();
  }));
};

// ── Lifecycle ──────────────────────────────────────────────────────────────
export const start = (userId) => {
  if (!supabase || !userId) return;
  _userId = userId;
  if (_running) return;
  _running = true;
  subscribePush();
};

export const stop = () => {
  _running = false;
  _userId = null;
  _unsubs.forEach(fn => { try { fn(); } catch { /* noop */ } });
  _unsubs.length = 0;
  _dirty.clear();
  _pushWorkspaces = false;
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  setStatus({ state: 'idle', lastError: null });
};
