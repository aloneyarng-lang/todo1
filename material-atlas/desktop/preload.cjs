const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('materiaDesktop', {
  agentGetConfig: () => ipcRenderer.invoke('agent:get-config'),
  agentSaveConfig: value => ipcRenderer.invoke('agent:save-config', value),
  agentRun: payload => ipcRenderer.invoke('agent:run', payload),
  agentCancel: id => ipcRenderer.invoke('agent:cancel', id),
  agentOpenLink: url => ipcRenderer.invoke('agent:open-link', url),
  agentGetHistory: () => ipcRenderer.invoke('agent:get-history'),
  agentSaveHistory: payload => ipcRenderer.invoke('agent:save-history', payload),
  onAgentProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('agent:progress', listener);
    return () => ipcRenderer.removeListener('agent:progress', listener);
  },
  canvasGet: () => ipcRenderer.invoke('canvas:get'),
  canvasSave: payload => ipcRenderer.invoke('canvas:save',payload),
  requestClose: () => ipcRenderer.invoke('canvas:request-close'),
  canvasReady: () => ipcRenderer.invoke('canvas:ready'),
  canvasConfirmClose: () => ipcRenderer.invoke('canvas:confirm-close'),
  onCanvasClose: callback => {const listener=()=>callback();ipcRenderer.on('canvas:prepare-close',listener);return()=>ipcRenderer.removeListener('canvas:prepare-close',listener);},
  getPapers: () => ipcRenderer.invoke('library:get-papers'),
  putPapers: papers => ipcRenderer.invoke('library:put-papers', papers),
  deletePaper: id => ipcRenderer.invoke('library:delete-paper', id),
  deletePapers: ids => ipcRenderer.invoke('library:delete-papers', ids),
  bulkEdit: (ids, options) => ipcRenderer.invoke('library:bulk-edit', ids, options),
  restorePapers: id => ipcRenderer.invoke('library:restore-papers', id),
  getSetting: key => ipcRenderer.invoke('library:get-setting', key),
  setSetting: (key, value) => ipcRenderer.invoke('library:set-setting', key, value),
  mergeBackup: backup => ipcRenderer.invoke('library:merge-backup', backup),
  readPdf: id => ipcRenderer.invoke('library:read-pdf', id),
  openPdf: id => ipcRenderer.invoke('library:open-pdf', id),
  savePdf: id => ipcRenderer.invoke('library:save-pdf', id),
  info: () => ipcRenderer.invoke('library:info'),
  chooseFolder: () => ipcRenderer.invoke('library:choose-folder'),
  openFolder: () => ipcRenderer.invoke('library:open-folder'),
  saveBackup: json => ipcRenderer.invoke('library:save-backup', json),
  saveText: data => ipcRenderer.invoke('library:save-text', data),
  saveImage: data => ipcRenderer.invoke('library:save-image', data),
});
