import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { LocalLibrary } from './library.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.commandLine.appendSwitch('force-renderer-accessibility');
const profile = process.env.MATERIA_PROFILE_DIR || (app.isPackaged ? app.getPath('userData') : path.join(appRoot, '.local', 'desktop-profile'));
app.setPath('userData', profile);
let mainWindow, library;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Materia 无法启动', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());

async function start() {
  await mkdir(profile, { recursive: true });
  let config = {};
  try { config = JSON.parse(await readFile(path.join(profile, 'preferences.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const defaultRoot = process.env.MATERIA_LIBRARY_DIR || (app.isPackaged ? path.join(path.dirname(app.getPath('exe')), '文献库') : path.join(appRoot, '.local', 'desktop-library'));
  const previousRoot = app.isPackaged ? path.resolve(path.dirname(app.getPath('exe')), '..', '..', 'Materia-win32-x64', '文献库') : '';
  const startupRoot = process.env.MATERIA_LIBRARY_DIR || config.libraryPath || (previousRoot && existsSync(path.join(previousRoot, 'library.json')) ? previousRoot : defaultRoot);
  library = await new LocalLibrary(startupRoot).init();
  await writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ libraryPath: library.root }, null, 2));
  mainWindow = new BrowserWindow({ width: 1440, height: 980, minWidth: 1000, minHeight: 700, title: 'Materia · 材料文献星图', backgroundColor: '#f7f7f2', autoHideMenuBar: true, webPreferences: { preload: path.join(appRoot, 'desktop', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  Menu.setApplicationMenu(null);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== mainWindow.webContents.getURL()) event.preventDefault(); });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  const handle = (channel, fn) => ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('不受支持的请求来源。');
    return fn(...args);
  });
  handle('library:get-papers', () => library.getPapers());
  handle('library:put-papers', papers => library.putPapers(papers));
  handle('library:delete-paper', id => library.deletePaper(id));
  handle('library:delete-papers', ids => library.deletePapers(ids));
  handle('library:bulk-edit', (ids, options) => library.bulkEdit(ids, options));
  handle('library:restore-papers', id => library.restorePapers(id));
  handle('library:get-setting', key => library.getSetting(key));
  handle('library:set-setting', (key, value) => library.setSetting(key, value));
  handle('library:merge-backup', backup => library.mergeBackup(backup));
  handle('library:read-pdf', id => library.readPdf(id));
  handle('library:info', () => library.info());
  handle('library:open-pdf', async id => { const result = await shell.openPath(await library.pdfPath(id)); if (result) throw new Error(result); });
  handle('library:save-pdf', async id => {
    const p = library.data.papers.find(p => p.id === id); if (!p) throw new Error('找不到文献。');
    const chosen = await dialog.showSaveDialog(mainWindow, { title: '另存 PDF', defaultPath: p.filename, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!chosen.canceled) await copyFile(await library.pdfPath(id), chosen.filePath);
    return { canceled: chosen.canceled };
  });
  handle('library:open-folder', async () => { const result = await shell.openPath(library.root); if (result) throw new Error(result); });
  handle('library:choose-folder', async () => {
    const chosen = await dialog.showOpenDialog(mainWindow, { title: '选择或新建文献库文件夹', defaultPath: library.root, properties: ['openDirectory', 'createDirectory'] });
    if (chosen.canceled) return null;
    await library.queue;
    const next = await new LocalLibrary(chosen.filePaths[0]).init();
    await writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ libraryPath: next.root }, null, 2));
    library = next; return library.info();
  });
  handle('library:save-backup', async json => {
    if (typeof json !== 'string' || json.length > 1024 * 1024 * 1024) throw new Error('备份内容过大。');
    const chosen = await dialog.showSaveDialog(mainWindow, { title: '导出完整文献备份', defaultPath: path.join(library.root, 'backups', `materia-backup-${new Date().toISOString().slice(0, 10)}.json`), filters: [{ name: 'Materia 备份', extensions: ['json'] }] });
    if (chosen.canceled) return { canceled: true };
    await writeFile(chosen.filePath, json, 'utf8'); return { canceled: false, path: chosen.filePath };
  });
  handle('library:save-text', async ({ filename, content, type }) => {
    if (!['json', 'csv', 'md', 'svg'].includes(type) || typeof content !== 'string' || content.length > 30 * 1024 * 1024) throw new Error('导出格式不正确。');
    const chosen = await dialog.showSaveDialog(mainWindow, { title: '保存导入模板', defaultPath: path.basename(filename), filters: [{ name: type.toUpperCase(), extensions: [type] }] });
    if (!chosen.canceled) await writeFile(chosen.filePath, content, 'utf8');
    return { canceled: chosen.canceled };
  });
  handle('library:save-image', async ({filename,bytes,type}) => {
    const image = Buffer.from(bytes || []);
    if (type !== 'png' || image.length > 128 * 1024 * 1024 || image.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('图像格式不正确。');
    const chosen = await dialog.showSaveDialog(mainWindow,{title:'保存性能对比图',defaultPath:path.basename(filename),filters:[{name:'PNG 图像',extensions:['png']}]});
    if (!chosen.canceled) await writeFile(chosen.filePath,image);
    return {canceled:chosen.canceled,path:chosen.filePath};
  });
  await mainWindow.loadFile(path.join(appRoot, 'dist', 'index.html'));
}
