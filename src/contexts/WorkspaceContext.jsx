import React, { createContext, useContext, useState } from 'react';
import {
  loadWorkspaces,
  saveWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspace,
  deleteWorkspaceData,
  WORKSPACE_DEFAULT_ID,
} from '../utils/storage';
import { deleteWorkspaceRemote } from '../utils/syncEngine';

const WorkspaceContext = createContext();

export const useWorkspaces = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaces must be used within a WorkspaceProvider');
  }
  return context;
};

// Workspaces isolate one freelancer-client's data (time logs, invoices,
// timezone, display preferences). Switching is a hard reload: every other
// context (timezone, preferences) reads its per-workspace values once on
// mount, so a reload is the simplest reliable way to re-initialize the whole
// app against the newly active workspace without threading the active id
// through every component's local state.
export const WorkspaceProvider = ({ children }) => {
  const [workspaces, setWorkspaces] = useState(() => loadWorkspaces());
  const [activeId] = useState(() => getActiveWorkspaceId());

  const persist = (list) => {
    setWorkspaces(list);
    saveWorkspaces(list);
  };

  const generateId = () =>
    `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Create a new workspace and immediately switch to it (reloads the app).
  const createAndSwitch = async (name) => {
    const trimmed = (name || '').trim() || 'Untitled workspace';
    const id = generateId();
    persist([...workspaces, { id, name: trimmed }]);
    await setActiveWorkspace(id);
    window.location.reload();
  };

  const renameWorkspace = (id, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    persist(workspaces.map(w => (w.id === id ? { ...w, name: trimmed } : w)));
  };

  const switchWorkspace = async (id) => {
    if (id === activeId) return;
    await setActiveWorkspace(id);
    window.location.reload();
  };

  // Permanently delete a workspace and all of its data. The list must never be
  // emptied; deleting the active workspace switches to a remaining one (which
  // reloads the app).
  const deleteWorkspace = async (id) => {
    if (workspaces.length <= 1) return;
    await deleteWorkspaceData(id);
    // Tombstone in the cloud synchronously BEFORE the reload below, otherwise
    // the deletion loses the race with the debounced background push and sync
    // resurrects the workspace from its still-live cloud row. No-op when offline.
    await deleteWorkspaceRemote(id);
    const remaining = workspaces.filter(w => w.id !== id);
    persist(remaining);
    if (id === activeId) {
      await setActiveWorkspace(remaining[0].id);
      window.location.reload();
    }
  };

  const value = {
    workspaces,
    activeId,
    activeWorkspace: workspaces.find(w => w.id === activeId) || workspaces[0],
    isDefault: activeId === WORKSPACE_DEFAULT_ID,
    createAndSwitch,
    renameWorkspace,
    switchWorkspace,
    deleteWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export default WorkspaceContext;
