import { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage } from 'electron';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLibraryRoot } from './library-location.mjs';
import { LocalLibrary } from './library.mjs';
import { AgentSettings, completeWithProvider,testAgentConnection } from './agent.mjs';
import { runResearchAgent } from '../dist/ai-agent-core.js';
import { AgentHistoryFile } from './agent-history.mjs';
import { translateText } from './translation.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.commandLine.appendSwitch('force-renderer-accessibility');
const profile = process.env.MATERIA_PROFILE_DIR || (app.isPackaged ? app.getPath('userData') : path.join(appRoot, '.local', 'desktop-profile'));
app.setPath('userData', profile);
let mainWindow, library, agentHistory;
let agentRun = null,connectionTest=null;
const translationRuns=new Map();
function cancelTranslations(){for(const controller of translationRuns.values())controller.abort();connectionTest?.abort();}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('Materia 无法启动', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
let quitPending=false;
app.on('before-quit',event=>{
  if(!agentHistory||quitPending)return;
  event.preventDefault();quitPending=true;agentRun?.controller.abort();cancelTranslations();
  Promise.allSettled([agentHistory.queue,library.queue]).then(()=>app.quit());
});

async function start() {
  await mkdir(profile, { recursive: true });
  const agentSettings = new AgentSettings(profile, safeStorage);
  await agentSettings.load().catch(() => {});
  let config = {};
  try { config = JSON.parse(await readFile(path.join(profile, 'preferences.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const defaultRoot = process.env.MATERIA_LIBRARY_DIR || (app.isPackaged ? path.join(path.dirname(app.getPath('exe')), '文献库') : path.join(appRoot, '.local', 'desktop-library'));
  const previousRoot = app.isPackaged ? path.resolve(path.dirname(app.getPath('exe')), '..', '..', 'Materia-win32-x64', '文献库') : '';
  const startupRoot = resolveLibraryRoot({envRoot:process.env.MATERIA_LIBRARY_DIR,configuredRoot:config.libraryPath,previousRoot,defaultRoot});
  library = await new LocalLibrary(startupRoot).init();
  agentHistory = new AgentHistoryFile(library.root);
  await writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ libraryPath: library.root }, null, 2));
  mainWindow = new BrowserWindow({ show: process.env.MATERIA_HEADLESS !== '1', width: 1440, height: 980, minWidth: 1000, minHeight: 700, title: 'Materia · 材料文献星图', backgroundColor: '#f7f7f2', autoHideMenuBar: true, webPreferences: { preload: path.join(appRoot, 'desktop', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
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
  handle('study:read',async()=>{const store=library;await store.queue;return{libraryKey:store.root,...store.getStudy()};});
  handle('study:update',payload=>{if(!payload||payload.libraryKey!==library.root)throw new Error('文献库已切换，阅读记录未写入其他文献库。');return library.updateStudy(payload.operation);});
  handle('translation:cancel',id=>translationRuns.get(id)?.abort());
  handle('translation:run',async payload=>{
    if(!payload||typeof payload.id!=='string'||!/^[a-z\d_-]{1,120}$/i.test(payload.id)||translationRuns.has(payload.id))throw new Error('翻译请求标识无效。');
    if(translationRuns.size>=3)throw new Error('翻译请求过多，请等待或停止当前翻译。');
    if(!agentSettings.config?.model)throw new Error('请先在 AI 研究助手中保存服务地址和模型。');
    const controller=new AbortController();translationRuns.set(payload.id,controller);
    try{return await translateText({...agentSettings.config},payload.request,{signal:controller.signal});}
    catch(error){return{error:controller.signal.aborted?'翻译已停止。':error.message,canceled:controller.signal.aborted};}
    finally{translationRuns.delete(payload.id);}
  });
  const publicAgentConfig=()=>({...agentSettings.publicConfig(),appVersion:app.getVersion()});
  handle('agent:get-config', publicAgentConfig);
  handle('agent:get-history', async () => { const store=agentHistory;await store.queue;return {libraryKey:store.root,state:await store.load()}; });
  handle('agent:save-history', payload => {
    if(!payload||payload.libraryKey!==agentHistory.root)throw new Error('文献库已切换，历史记录未写入其他文献库。');
    return agentHistory.save(payload.state);
  });
  handle('agent:open-link', async value => {
    if (typeof value !== 'string' || value.length > 8000) throw new Error('链接格式无效。');
    const url = new URL(value);
    if (!['https:','http:'].includes(url.protocol)) throw new Error('只支持网页链接。');
    await shell.openExternal(url.href);
  });
  handle('agent:save-config', async value => {await agentSettings.save(value);return publicAgentConfig();});
  handle('agent:test-connection',async value=>{
    if(connectionTest)throw new Error('正在检测连接，请稍候。');const controller=new AbortController();connectionTest=controller;
    try{await agentSettings.queue;return await testAgentConnection(value?agentSettings.resolve(value):agentSettings.config||{},{signal:controller.signal});}
    finally{if(connectionTest===controller)connectionTest=null;}
  });
  handle('agent:cancel', id => { if (agentRun?.id === id) agentRun.controller.abort(); });
  handle('agent:run', async payload => {
    if (agentRun) throw new Error('请先停止当前回答。');
    if (!payload || typeof payload.id !== 'string' || payload.id.length > 100) throw new Error('请求格式无效。');
    if (!agentSettings.config) throw new Error('请先配置 AI 服务。');
    const controller = new AbortController(), config = { ...agentSettings.config };
    const runSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(300000)]);
    const current = { id: payload.id, controller }; agentRun = current;
    try {
      const context = { papers: structuredClone(library.getPapers()), notes: structuredClone(library.getSetting('notes') || {}), scopeIds: payload.scopeIds ?? null };
      return await runResearchAgent({ question: payload.question, history: payload.history, context,
        signal: runSignal,
        complete: input => completeWithProvider(config, input),
        onProgress: progress => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('agent:progress', { id: payload.id, ...progress }); },
      });
    } catch (error) {
      return { error: controller.signal.aborted ? '已停止生成。' : runSignal.aborted ? '本次研究已超时，请缩小范围后重试。' : (error.message || 'AI 请求失败，请重试。'), canceled: controller.signal.aborted };
    } finally { if (agentRun === current) agentRun = null; }
  });
  mainWindow.on('closed', () => {agentRun?.controller.abort();cancelTranslations();});
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
    agentRun?.controller.abort();
    cancelTranslations();
    await library.queue;
    await agentHistory.queue;
    const next = await new LocalLibrary(chosen.filePaths[0]).init();
    await writeFile(path.join(profile, 'preferences.json'), JSON.stringify({ libraryPath: next.root }, null, 2));
    library = next; agentHistory = new AgentHistoryFile(library.root); return library.info();
  });
  handle('library:save-backup', async json => {
    if (typeof json !== 'string' || json.length > 1024 * 1024 * 1024) throw new Error('备份内容过大。');
    const chosen = await dialog.showSaveDialog(mainWindow, { title: '导出完整文献备份', defaultPath: path.join(library.root, 'backups', `materia-backup-${new Date().toISOString().slice(0, 10)}.json`), filters: [{ name: 'Materia 备份', extensions: ['json'] }] });
    if (chosen.canceled) return { canceled: true };
    await writeFile(chosen.filePath, json, 'utf8'); return { canceled: false, path: chosen.filePath };
  });
  handle('library:save-text', async ({ filename, content, type }) => {
    if (!['json', 'csv', 'md', 'svg', 'css'].includes(type) || typeof content !== 'string' || content.length > 30 * 1024 * 1024) throw new Error('导出格式不正确。');
    const chosen = await dialog.showSaveDialog(mainWindow, { title: '保存导出文件', defaultPath: path.basename(filename), filters: [{ name: type.toUpperCase(), extensions: [type] }] });
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
