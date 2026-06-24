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
// Doc ids with an unresolved conflict. These are frozen from auto-sync: we
// neither push them (which would silently converge local→cloud and make the
// conflict vanish on the next load) nor mark them dirty, until the user picks.
const _conflicted = new Set();
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

// Canonical comparable form. For ls we normalize JSON (parse → stable) so two
// equivalent blobs that differ only in key order or whitespace don't read as a
// conflict; non-JSON strings compare as-is.
const canonical = (kind, val) => {
  if (kind === 'idb') return stable(val ?? null);
  if (val == null) return 'null';
  try { return stable(JSON.parse(val)); } catch { return JSON.stringify(val); }
};

const valuesEqual = (kind, a, b) => canonical(kind, a) === canonical(kind, b);

// Coerce a stored value to a plain object for field-level diffing, or null if
// it isn't one (scalars and arrays fall back to whole-value conflict handling).
const toObject = (kind, val) => {
  let obj = val;
  if (kind !== 'idb') {
    if (val == null) return null;
    try { obj = JSON.parse(val); } catch { return null; }
  }
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
};

// "hourlyRate" → "Hourly rate"; date keys (timesheet) are left as-is.
const humanizeKey = (k) => {
  if (/^\d{4}-\d{2}-\d{2}/.test(k)) return k;
  const spaced = k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Build the per-field diff for an object-valued document. Returns the list of
// changed fields (each with both values + presence), or null when the value
// isn't a plain object — in which case the caller treats it as a single value.
const diffFields = (kind, localVal, cloudVal) => {
  const lo = toObject(kind, localVal);
  const co = toObject(kind, cloudVal);
  if (!lo || !co) return null;
  const keys = new Set([...Object.keys(lo), ...Object.keys(co)]);
  const fields = [];
  for (const k of keys) {
    const lHas = Object.prototype.hasOwnProperty.call(lo, k);
    const cHas = Object.prototype.hasOwnProperty.call(co, k);
    if (lHas && cHas && stable(lo[k]) === stable(co[k])) continue; // unchanged
    fields.push({
      key: k,
      label: humanizeKey(k),
      localValue: lHas ? lo[k] : undefined,
      cloudValue: cHas ? co[k] : undefined,
      localPresent: lHas,
      cloudPresent: cHas,
    });
  }
  return fields.length ? fields : null;
};

// ── Time-entry & weekly merge ──────────────────────────────────────────────
// Time entries sync per ENTRY (by id), not as one opaque blob. This lets a
// running timer simply appear on other devices (its stored form is just a
// startTime — the ticking clock is computed live, never saved), lets a stop on
// one device win over a still-running copy on another, and merges independent
// edits without a prompt. We use a 3-way merge against a per-account "base"
// snapshot of the last synced state, so deletes propagate instead of resurrecting.
const TIMESHEET_KEY = 'kronos_timesheet_data';
const WEEKLY_KEY = 'kronos_weekly_timesheet';

const isCompleted = (e) => e && e.isActive !== true && !!e.endTime;

// Flatten { day: [entries] } → Map(entryId → { day, entry }).
const flattenEntries = (blob) => {
  const m = new Map();
  for (const [day, arr] of Object.entries(blob || {})) {
    if (!Array.isArray(arr)) continue;
    for (const e of arr) if (e && e.id) m.set(e.id, { day, entry: e });
  }
  return m;
};

// Map(entryId → { day, entry }) → { day: [entries] }, days sorted by start.
const rebuildEntries = (map) => {
  const out = {};
  for (const { day, entry } of map.values()) (out[day] ||= []).push(entry);
  for (const day of Object.keys(out)) {
    out[day].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  }
  return out;
};

// Human label for an entry in the conflict dialog.
const entryLabel = (e) => {
  if (!e) return 'entry';
  const desc = (e.description || '').trim() || 'Untitled';
  const t = e.startTime ? e.startTime.slice(11, 16) : '';
  return t ? `${desc} · ${t}` : desc;
};

// 3-way merge of time entries. Returns { merged, conflicts } where merged is the
// fully-resolved blob (clashes default to the local copy as a placeholder) and
// conflicts lists genuine same-entry edit clashes for the UI to resolve.
const mergeEntries = (baseBlob, localBlob, cloudBlob) => {
  const base = flattenEntries(baseBlob);
  const local = flattenEntries(localBlob);
  const cloud = flattenEntries(cloudBlob);
  const ids = new Set([...base.keys(), ...local.keys(), ...cloud.keys()]);
  const out = new Map();
  const conflicts = [];
  for (const id of ids) {
    const b = base.get(id), l = local.get(id), c = cloud.get(id);
    const bc = b ? stable(b.entry) : null;
    const lc = l ? stable(l.entry) : null;
    const cc = c ? stable(c.entry) : null;
    const lChanged = lc !== bc;
    const cChanged = cc !== bc;

    if (!lChanged && !cChanged) { if (l) out.set(id, l); continue; }
    if (lChanged && !cChanged) { if (l) out.set(id, l); continue; }   // local edit/delete
    if (!lChanged && cChanged) { if (c) out.set(id, c); continue; }   // cloud edit/delete
    if (lc === cc) { if (l) out.set(id, l); continue; }               // same change both sides

    // Both diverged. Auto-resolve the unambiguous cases:
    if (l && c) {
      if (isCompleted(l.entry) && !isCompleted(c.entry)) { out.set(id, l); continue; } // stop wins
      if (isCompleted(c.entry) && !isCompleted(l.entry)) { out.set(id, c); continue; }
    }
    if (!l || !c) { out.set(id, l || c); continue; } // edit-vs-delete → keep the surviving edit

    // Genuine clash: same entry, both completed, edited differently → ask.
    out.set(id, l); // placeholder; resolution overrides
    conflicts.push({ id, day: l.day, cloudDay: c.day, local: l.entry, cloud: c.entry });
  }
  return { merged: rebuildEntries(out), conflicts };
};

// Weekly summary is derived data; merge it by date, auto-resolving clashes to
// the cloud copy (it self-heals when that day is next recomputed locally).
const mergeWeekly = (baseBlob, localBlob, cloudBlob) => {
  const base = new Map(Object.entries(baseBlob || {}));
  const local = new Map(Object.entries(localBlob || {}));
  const cloud = new Map(Object.entries(cloudBlob || {}));
  const keys = new Set([...base.keys(), ...local.keys(), ...cloud.keys()]);
  const out = {};
  for (const k of keys) {
    const b = base.get(k), l = local.get(k), c = cloud.get(k);
    const bc = b === undefined ? null : stable(b);
    const lc = l === undefined ? null : stable(l);
    const cc = c === undefined ? null : stable(c);
    const lChanged = lc !== bc, cChanged = cc !== bc;
    let pick;
    if (!lChanged && !cChanged) pick = l;
    else if (lChanged && !cChanged) pick = l;
    else if (!lChanged && cChanged) pick = c;
    else pick = c !== undefined ? c : l; // both changed → cloud wins (derived)
    if (pick !== undefined) out[k] = pick;
  }
  return out;
};

const isMergedKey = (baseKey) => baseKey === TIMESHEET_KEY || baseKey === WEEKLY_KEY;

// Remove an entry by id from a { day: [entries] } blob, in place.
const removeEntryById = (blob, id) => {
  for (const day of Object.keys(blob)) {
    if (!Array.isArray(blob[day])) continue;
    blob[day] = blob[day].filter(e => e.id !== id);
    if (blob[day].length === 0) delete blob[day];
  }
};

// ── Per-account merge base (last-synced snapshot, in IndexedDB) ─────────────
const baseStorageKey = (wsId, docKey) =>
  storageKeyFor(wsId, `__sync_base__${_userId}__${docKey}`);
const loadBase = async (wsId, docKey) => (await idbGet(baseStorageKey(wsId, docKey))) ?? {};
const saveBase = (wsId, docKey, blob) => {
  idbSet(baseStorageKey(wsId, docKey), blob).catch(e => console.error('Sync base save failed:', e));
};

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

// Fetch a single document's current cloud value ({} if absent/deleted).
const fetchOneDoc = async (wsId, baseKey) => {
  const { data, error } = await supabase
    .from(DOCS_TABLE)
    .select('data, deleted')
    .eq('user_id', _userId)
    .eq('workspace_id', wsId)
    .eq('doc_key', baseKey)
    .maybeSingle();
  if (error) throw error;
  return data && !data.deleted ? data.data : {};
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

    const wsName = (wsId) => wsId === GLOBAL_WS
      ? null
      : (mergedWs.find(w => w.id === wsId)?.name ?? wsId);

    for (const d of descs) {
      const rawLocal = await readLocal(d.wsId, d.baseKey, d.kind);
      const cloudRow = cloudDocs.get(docId(d.wsId, d.baseKey));

      // Time entries & weekly summary: per-entry / per-date 3-way merge.
      if (isMergedKey(d.baseKey)) {
        const local = rawLocal ?? {};
        const cloud = cloudRow?.data ?? {};
        const base = await loadBase(d.wsId, d.baseKey);
        if (d.baseKey === TIMESHEET_KEY) {
          const { merged, conflicts: entryClashes } = mergeEntries(base, local, cloud);
          if (entryClashes.length > 0) {
            // Hold all of this doc's changes until the user resolves the clashes.
            conflicts.push({
              id: docId(d.wsId, d.baseKey),
              wsId: d.wsId, baseKey: d.baseKey, kind: d.kind,
              label: docLabel(d.baseKey), workspaceName: wsName(d.wsId),
              isEntryMerge: true,
              mergedBlob: merged,
              fields: entryClashes.map(x => ({
                key: x.id,
                label: entryLabel(x.local || x.cloud),
                localValue: x.local, cloudValue: x.cloud,
                localDay: x.day, cloudDay: x.cloudDay,
                localPresent: true, cloudPresent: true,
              })),
            });
            continue;
          }
          if (stable(merged) !== stable(local)) pullList.push({ d, value: merged });
          if (stable(merged) !== stable(cloud)) pushList.push({ d, value: merged });
          saveBase(d.wsId, d.baseKey, merged);
        } else {
          const merged = mergeWeekly(base, local, cloud);
          if (stable(merged) !== stable(local)) pullList.push({ d, value: merged });
          if (stable(merged) !== stable(cloud)) pushList.push({ d, value: merged });
          saveBase(d.wsId, d.baseKey, merged);
        }
        continue;
      }

      const localHas = isPresent(d.kind, rawLocal);
      const cloudHas = cloudRow != null && isPresent(d.kind, cloudRow.data);

      if (!localHas && !cloudHas) continue;
      if (localHas && !cloudHas) { pushList.push({ d, value: rawLocal }); continue; }
      if (!localHas && cloudHas) { pullList.push({ d, value: cloudRow.data }); continue; }
      if (valuesEqual(d.kind, rawLocal, cloudRow.data)) continue;
      conflicts.push({
        id: docId(d.wsId, d.baseKey),
        wsId: d.wsId,
        baseKey: d.baseKey,
        kind: d.kind,
        label: docLabel(d.baseKey),
        workspaceName: wsName(d.wsId),
        localValue: rawLocal,
        cloudValue: cloudRow.data,
        // Per-field diff for object documents (invoice settings, colors). null →
        // the UI offers a single whole-value choice.
        fields: diffFields(d.kind, rawLocal, cloudRow.data),
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

    // Freeze the conflicting docs from auto-sync until the user resolves them,
    // so a background push can't silently converge (and hide) the conflict.
    _conflicted.clear();
    for (const c of conflicts) _conflicted.add(c.id);

    const changedLocal = wsChanged || pullList.length > 0;
    setStatus({ state: 'synced', lastSyncedAt: new Date().toISOString() });
    return { conflicts, changedLocal };
  } catch (err) {
    console.error('Sync reconcile failed:', err);
    setStatus({ state: 'error', lastError: err.message || String(err) });
    return { conflicts: [], changedLocal: false, error: err };
  }
};

// Merge an object document field-by-field from per-field choices. Unchanged
// fields are kept as-is; changed fields take the chosen side (omitted if that
// side didn't have the field, i.e. a deletion). Returns the value to store
// (object for idb, JSON string for ls).
const mergeFields = (c, fieldChoices) => {
  const lo = toObject(c.kind, c.localValue) || {};
  const co = toObject(c.kind, c.cloudValue) || {};
  const changed = new Map(c.fields.map(f => [f.key, f]));
  const keys = new Set([...Object.keys(lo), ...Object.keys(co)]);
  const merged = {};
  for (const k of keys) {
    if (!changed.has(k)) { merged[k] = lo[k]; continue; } // identical both sides
    const src = (fieldChoices[k] || 'local') === 'cloud' ? co : lo;
    if (Object.prototype.hasOwnProperty.call(src, k)) merged[k] = src[k];
  }
  return c.kind === 'idb' ? merged : JSON.stringify(merged);
};

// Resolve the conflicts reconcile() surfaced. For object documents `choices[id]`
// is a per-field map ({ fieldKey: 'local'|'cloud' }); for scalar documents it's
// a single 'local'|'cloud'. Returns true if any local data changed.
export const resolveConflicts = async (conflicts, choices) => {
  if (!supabase || !_userId) return false;
  setStatus({ state: 'syncing', lastError: null });
  let changedLocal = false;
  try {
    _applyingRemote = true;
    for (const c of conflicts) {
      if (c.isEntryMerge) {
        // Timesheet: start from the auto-merged blob, then override each clashing
        // entry with the chosen side. Same value goes to local, cloud, and base.
        const merged = JSON.parse(JSON.stringify(c.mergedBlob));
        const fieldChoices = choices[c.id] || {};
        for (const f of c.fields) {
          const pick = fieldChoices[f.key] || 'local';
          const entry = pick === 'cloud' ? f.cloudValue : f.localValue;
          const day = pick === 'cloud' ? (f.cloudDay || f.localDay) : f.localDay;
          removeEntryById(merged, f.key);
          if (entry) (merged[day] ||= []).push(entry);
        }
        await writeLocal(c.wsId, c.baseKey, c.kind, merged);
        await upsertDoc(c.wsId, c.baseKey, merged);
        saveBase(c.wsId, c.baseKey, merged);
        changedLocal = true;
      } else if (c.fields) {
        // Field-level merge → write the merged result to both sides.
        const merged = mergeFields(c, choices[c.id] || {});
        await writeLocal(c.wsId, c.baseKey, c.kind, merged);
        await upsertDoc(c.wsId, c.baseKey, merged);
        changedLocal = true;
      } else {
        const pick = choices[c.id] || 'local';
        if (pick === 'cloud') {
          await writeLocal(c.wsId, c.baseKey, c.kind, c.cloudValue);
          changedLocal = true;
        } else {
          // Local wins — overwrite cloud so the two sides converge.
          await upsertDoc(c.wsId, c.baseKey, c.localValue);
        }
      }
      _conflicted.delete(c.id); // unfreeze: this doc may auto-sync again
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
      if (_conflicted.has(id)) continue; // don't push a doc with an open conflict
      const [wsId, baseKey] = id.split('::');
      const kind = WS_IDB_KEYS.includes(baseKey) ? 'idb' : 'ls';

      // Time entries & weekly: merge against the cloud before pushing so we never
      // clobber entries another device added that we haven't pulled yet.
      if (isMergedKey(baseKey)) {
        const local = (await readLocal(wsId, baseKey, 'idb')) ?? {};
        const cloud = await fetchOneDoc(wsId, baseKey);
        const base = await loadBase(wsId, baseKey);
        if (baseKey === TIMESHEET_KEY) {
          const { merged, conflicts } = mergeEntries(base, local, cloud);
          if (conflicts.length > 0) {
            // Genuine same-entry clash: keep the cloud copy of each clashing entry
            // and DON'T advance base, so the next reconcile surfaces the prompt
            // instead of silently letting this device win.
            for (const x of conflicts) {
              removeEntryById(merged, x.id);
              (merged[x.cloudDay || x.day] ||= []).push(x.cloud);
            }
            await upsertDoc(wsId, baseKey, merged);
          } else {
            await upsertDoc(wsId, baseKey, merged);
            saveBase(wsId, baseKey, merged);
          }
        } else {
          const merged = mergeWeekly(base, local, cloud);
          await upsertDoc(wsId, baseKey, merged);
          saveBase(wsId, baseKey, merged);
        }
        continue;
      }

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
  const id = docId(wsId, baseKey);
  if (_conflicted.has(id)) return; // frozen until the user resolves the conflict
  _dirty.add(id);
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
  _conflicted.clear();
  _pushWorkspaces = false;
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  setStatus({ state: 'idle', lastError: null });
};
