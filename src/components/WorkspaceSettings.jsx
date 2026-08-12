import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase, Check, Pencil, Trash2, AlertTriangle, Plus, X, ArrowRightLeft,
} from 'lucide-react';
import { useWorkspaces } from '../contexts/WorkspaceContext';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

/**
 * Settings → Account → Workspaces. Everything the old "Manage workspaces" modal
 * did — rename, delete, and now switching and creating too — laid out as a
 * section of the page, so managing workspaces doesn't mean working inside a
 * dialog stacked over whatever you were doing.
 *
 * The sidebar switcher still owns the quick switch; this is the full list.
 */
const WorkspaceSettings = () => {
  const {
    workspaces, activeId, createAndSwitch, renameWorkspace, switchWorkspace, deleteWorkspace,
  } = useWorkspaces();
  const { getTransition } = useMotionPreferences();

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const revealTransition = getTransition({ duration: 0.2, ease: 'easeOut' });

  const startEdit = (ws) => {
    setConfirmDeleteId(null);
    setEditingId(ws.id);
    setEditName(ws.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) renameWorkspace(editingId, editName);
    setEditingId(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const submitCreate = async () => {
    if (!newName.trim()) return;
    // Reloads the app, so there's nothing to reset here afterwards.
    await createAndSwitch(newName);
  };

  const isOnly = workspaces.length <= 1;

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <Briefcase className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-gray-900 tracking-tight">Workspaces</h4>
          <p className="text-[13px] text-gray-500">
            Separate sets of time logs, invoices, and preferences. Switching reloads the app.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {workspaces.map(ws => {
          const isActive = ws.id === activeId;
          const isEditing = editingId === ws.id;
          const isConfirming = confirmDeleteId === ws.id;

          return (
            <div
              key={ws.id}
              className={`rounded-xl border px-3 py-2.5 ${
                isActive ? 'border-blue-200/80 bg-blue-50/40' : 'border-gray-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      maxLength={60}
                      aria-label={`Rename ${ws.name}`}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                    <button
                      type="button"
                      onClick={commitEdit}
                      disabled={!editName.trim()}
                      className="shrink-0 px-2.5 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      aria-label="Cancel rename"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{ws.name}</span>
                      {isActive && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-100/80 text-blue-700 text-[10px] font-semibold px-2 py-0.5 ring-1 ring-blue-200/80">
                          <Check className="w-2.5 h-2.5" />
                          Active
                        </span>
                      )}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => switchWorkspace(ws.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-150"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Switch
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(ws)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                        aria-label={`Rename ${ws.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(isConfirming ? null : ws.id)}
                        disabled={isOnly}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors duration-150"
                        aria-label={`Delete ${ws.name}`}
                        title={isOnly ? 'At least one workspace is required' : undefined}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Two-step delete: it takes that workspace's time logs and
                  invoices with it, and nothing here can be undone. */}
              <AnimatePresence initial={false}>
                {isConfirming && !isEditing && (
                  <motion.div
                    className="overflow-hidden"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={revealTransition}
                  >
                    <div className="mt-2.5 rounded-lg bg-red-50 border border-red-200/70 p-3">
                      <div className="flex items-start gap-2 text-[13px] text-red-700">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                          Permanently delete <span className="font-semibold">{ws.name}</span> and all of its
                          time logs, invoices, and settings? This can't be undone.
                        </p>
                      </div>
                      <div className="mt-2.5 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-white transition-colors duration-150"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmDeleteId(null); deleteWorkspace(ws.id); }}
                          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-500 active:bg-red-700 transition-colors duration-150"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Fixed-height slot so swapping the button for the input doesn't shift
          the footnote below it, matching the sidebar switcher. */}
      <div className="relative mt-3 h-9">
        <AnimatePresence initial={false}>
          {creating ? (
            <motion.div
              key="create-form"
              className="absolute inset-0 flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder="Workspace name"
                maxLength={60}
                aria-label="New workspace name"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
              />
              <button
                type="button"
                onClick={submitCreate}
                disabled={!newName.trim()}
                className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => { setCreating(false); setNewName(''); }}
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="create-button"
              type="button"
              onClick={() => { setCreating(true); setNewName(''); }}
              className="absolute inset-0 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors duration-150"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <Plus className="w-4 h-4" />
              New workspace
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-400 leading-relaxed">
        Each workspace keeps its own time logs, weekly timesheet, invoice settings, timezone, and
        display preferences. Creating or switching to one reloads the app.
      </p>
    </div>
  );
};

export default WorkspaceSettings;
