import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Briefcase, Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react';
import { useWorkspaces } from '../contexts/WorkspaceContext';

// Sidebar control for switching between workspaces and creating one. Lives at
// the top of the sidebar nav. Switching reloads the app (handled in
// WorkspaceContext) so the dropdown state here is purely transient.
//
// Renaming and deleting live in Settings → Account → Workspaces rather than in
// a dialog over the sidebar; `onManage` is how this dropdown gets you there.
const WorkspaceSwitcher = ({ onManage }) => {
  const {
    workspaces, activeId, activeWorkspace,
    createAndSwitch, switchWorkspace,
  } = useWorkspaces();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const containerRef = useRef(null);
  const createInputRef = useRef(null);
  const prefersReduced = useReducedMotion();

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setCreating(false); } };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createAndSwitch(newName);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200/80 bg-gray-50/60 hover:bg-gray-100 transition-colors duration-150 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
          <Briefcase className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 leading-none mb-0.5">
            Workspace
          </span>
          <span className="block text-sm font-medium text-gray-900 truncate leading-tight">
            {activeWorkspace?.name ?? 'Default workspace'}
          </span>
        </span>
        <ChevronsUpDown className="w-4 h-4 shrink-0 text-gray-400" />
      </button>

      <AnimatePresence>
        {open && (
        <motion.div
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-lg border border-gray-200/80 overflow-hidden origin-top"
          role="listbox"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
          animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <div className="max-h-60 overflow-y-auto py-1.5">
            {workspaces.map(ws => {
              const isActive = ws.id === activeId;
              return (
                <button
                  key={ws.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => { setOpen(false); switchWorkspace(ws.id); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 ${
                    isActive ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">{ws.name}</span>
                  {isActive && <Check className="w-4 h-4 shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-gray-100 p-1.5 space-y-0.5">
            {/* Fixed-height slot so swapping the button for the input doesn't
                resize the dropdown (no layout shift). Both states are absolutely
                positioned and cross-fade in place. */}
            <div className="relative h-9">
            <AnimatePresence initial={false}>
              {creating ? (
                <motion.div
                  key="create-form"
                  className="absolute inset-0 flex items-center gap-1.5 px-1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  onAnimationComplete={() => createInputRef.current?.focus()}
                >
                  <input
                    ref={createInputRef}
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitCreate();
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                    }}
                    placeholder="Workspace name"
                    maxLength={60}
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitCreate}
                    disabled={!newName.trim()}
                    className="shrink-0 px-2.5 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  key="create-button"
                  type="button"
                  onClick={() => { setCreating(true); setNewName(''); }}
                  className="absolute inset-0 w-full flex items-center gap-2.5 px-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                >
                  <Plus className="w-4 h-4 text-gray-400" />
                  New workspace
                </motion.button>
              )}
            </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => { setOpen(false); onManage?.(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <Settings2 className="w-4 h-4 text-gray-400" />
              Manage workspaces
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceSwitcher;
