import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Briefcase, Check, ChevronsUpDown, Plus, Settings2, X,
  Pencil, Trash2, AlertTriangle,
} from 'lucide-react';
import { useWorkspaces } from '../contexts/WorkspaceContext';

// Sidebar control for switching between workspaces and opening the manager.
// Lives at the top of the sidebar nav. Switching reloads the app (handled in
// WorkspaceContext) so the dropdown state here is purely transient.
const WorkspaceSwitcher = () => {
  const {
    workspaces, activeId, activeWorkspace,
    createAndSwitch, switchWorkspace,
  } = useWorkspaces();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
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
              onClick={() => { setOpen(false); setManagerOpen(true); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150"
            >
              <Settings2 className="w-4 h-4 text-gray-400" />
              Manage workspaces
            </button>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managerOpen && <WorkspaceManagerModal onClose={() => setManagerOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

// Modal for renaming and deleting workspaces. Delete is two-step (confirm)
// because it permanently removes that workspace's time logs, invoices, and
// preferences.
const WorkspaceManagerModal = ({ onClose }) => {
  const { workspaces, activeId, renameWorkspace, deleteWorkspace } = useWorkspaces();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const prefersReduced = useReducedMotion();

  // Panel rises and fades in (bottom-sheet on mobile, centered card on
  // desktop); the list rows stagger in just behind it. Reduced-motion users
  // get a plain cross-fade with no movement or scale.
  const panelVariants = prefersReduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        visible: {
          opacity: 1, y: 0, scale: 1,
          transition: { type: 'spring', stiffness: 380, damping: 32, staggerChildren: 0.035, delayChildren: 0.04 },
        },
        exit: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15, ease: 'easeIn' } },
      };

  const rowVariants = prefersReduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

  const startEdit = (ws) => { setEditingId(ws.id); setEditName(ws.name); };
  const commitEdit = () => {
    if (editingId && editName.trim()) renameWorkspace(editingId, editName);
    setEditingId(null);
    setEditName('');
  };

  // Portal to <body>: the sidebar uses a CSS transform for its slide
  // animation, which would otherwise make this fixed overlay resolve relative
  // to the sidebar rather than the viewport (trapping it inside the sidebar).
  return createPortal(
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />

      <motion.div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-200/60 w-full max-w-md mx-0 sm:mx-4 max-h-[85vh] flex flex-col"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Briefcase className="w-[18px] h-[18px]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600 leading-none mb-1">
                Workspaces
              </p>
              <h2 className="font-display text-base font-semibold text-gray-900 leading-none">
                Manage workspaces
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-4 overflow-y-auto space-y-2">
          {workspaces.map(ws => {
            const isActive = ws.id === activeId;
            const isEditing = editingId === ws.id;
            const isConfirming = confirmDeleteId === ws.id;

            return (
              <motion.div key={ws.id} variants={rowVariants} className="rounded-xl border border-gray-200/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') { setEditingId(null); setEditName(''); }
                      }}
                      onBlur={commitEdit}
                      maxLength={60}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{ws.name}</span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-blue-50 text-blue-600 text-[10px] font-semibold px-2 py-0.5 ring-1 ring-blue-200/80">
                          Active
                        </span>
                      )}
                    </span>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(ws)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label={`Rename ${ws.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(isConfirming ? null : ws.id)}
                        disabled={workspaces.length <= 1}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400 transition-colors"
                        aria-label={`Delete ${ws.name}`}
                        title={workspaces.length <= 1 ? 'At least one workspace is required' : undefined}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {isConfirming && !isEditing && (
                    <motion.div
                      className="overflow-hidden"
                      initial={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={prefersReduced ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={prefersReduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
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
                            className="px-3 py-1.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-white transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => { setConfirmDeleteId(null); deleteWorkspace(ws.id); }}
                            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 leading-relaxed">
            Each workspace keeps its own time logs, weekly timesheet, invoice settings, timezone,
            and display preferences. Switching workspaces reloads the app.
          </p>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default WorkspaceSwitcher;
