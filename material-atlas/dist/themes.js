import {actionMenu} from './action-menus.js';
import {icon} from './icons.js';
import {createThemeRuntime,validateThemeResources} from './theme-runtime.js';
import {THEME_TOKENS,BUILTIN_THEMES,FONT_OPTIONS,MAX_THEME_BYTES,themeCSS,themePackage,resolveTheme,cleanThemePreferences,cleanFontScale,importThemeFiles,removeTheme} from './theme-model.js';
export * from './theme-model.js';
export function createThemeController(config){
 let preferences=cleanThemePreferences(),pending=null,busy=false,epoch=0,importRevision=0;const esc=config.escape,runtime=createThemeRuntime(()=>config.changed?.());
 const current=()=>pending||preferences;
 function applyFontScale(value){
  const percent=cleanFontScale(value);document.documentElement.style.setProperty('--ui-font-scale',String(percent/100));
  const output=document.querySelector('#theme-font-scale-value');if(output)output.textContent=`${percent}%`;
  const control=document.querySelector('[data-theme-font-scale]');if(control){control.value=String(percent);control.setAttribute('aria-valuetext',`${percent}%`);}
 }
 function apply(){
  const theme=runtime.apply(resolveTheme(current())),button=document.querySelector('#ribbon-theme');
  applyFontScale(current().fontScale);
  if(button){button.title=`主题：${theme.name}`;button.setAttribute('aria-label',`主题切换，当前${theme.name}`);}
  return theme;
 }
 function load(value){epoch++;pending=null;preferences=cleanThemePreferences(value);apply();}
 const swatches=theme=>{const t=theme.tokens;return `style="--preview-bg:${esc(t['--paper'])};--preview-surface:${esc(t['--surface'])};--preview-accent:${esc(t['--teal'])};--preview-ink:${esc(t['--ink'])};--preview-line:${esc(t['--line'])};--preview-radius:${theme.ui.cardRadius}px;--preview-stroke:${theme.icons.strokeWidth};--preview-font:${esc(t['--serif'])}"`;};
 function fontSettings(){
  const prefs=current(),options=role=>FONT_OPTIONS.map(font=>`<option value="${font.id}" ${(prefs.fonts?.[role]||'theme')===font.id?'selected':''}>${esc(font.name)}</option>`).join(''),count=Object.values(prefs.fonts||{}).filter(value=>value!=='theme').length;
  const scale=prefs.fontScale||100;
  return `<details class="theme-fonts"><summary>个人字体覆盖 <small>${count?count+' 项覆盖主题字体':'全部跟随主题'}</small></summary><div class="theme-fonts-heading"><strong>个人覆盖优先于主题，切换主题时保留</strong><button class="text-button" data-theme-action="reset-fonts" ${pending?'disabled':''}>恢复跟随主题</button></div><div class="theme-font-selects">${[['body','界面与正文'],['heading','文献与页面标题'],['numeric','数字与指标'],['mono','代码与等宽内容']].map(([role,label])=>`<label>${label}<select data-theme-font="${role}" aria-label="${label}字体" ${pending?'disabled':''}>${options(role)}</select></label>`).join('')}</div><div class="theme-font-size"><div class="theme-fonts-heading"><strong>界面字号</strong><button class="text-button" data-theme-action="reset-font-scale" ${pending?'disabled':''}>恢复默认字号</button></div><label for="theme-font-scale">当前缩放：<output id="theme-font-scale-value">${scale}%</output></label><input id="theme-font-scale" type="range" min="85" max="150" step="5" value="${scale}" data-theme-font-scale aria-label="界面字号" aria-valuetext="${scale}%" aria-describedby="theme-font-scale-help" ${pending?'disabled':''}><small id="theme-font-scale-help">拖动预览，松开后保存。适用于菜单、文献列表、笔记和 AI 聊天。</small></div><div class="theme-font-preview"><strong>材料的结构与性能 · Structure &amp; Properties</strong><p>在文献之间建立关联，记录你的研究思考。Materials connect ideas.</p><code>2026 · 1,250.00 MPa · sample_A</code></div><small>可选择本机字体；主题自带字体由资源包加载。PDF 原文与科研图像内部的字体不受界面主题影响。</small><span id="theme-font-status" role="status"></span></details>`;
 }
 function open(){
  const prefs=current(),themes=[...BUILTIN_THEMES.map(theme=>resolveTheme({...prefs,selected:theme.id})),...prefs.themes.map(row=>resolveTheme({...prefs,selected:row.id}))];
  config.showModal('主题与外观',pending?'正在预览导入主题，尚未写入文献库。':'内置卡片点击即应用；导入主题先预览，再保存。',`<div class="theme-intro"><p>字体、界面密度、卡片与图标组成完整外观。功能入口和快捷键保持一致。</p><div class="theme-tools"><button class="primary" data-theme-action="import" ${pending?'disabled':''}>导入主题包 / CSS</button>${actionMenu('theme-file-menu','主题文件','<button type="button" data-theme-action="template">下载完整主题模板</button><button type="button" data-theme-action="export">导出完整主题包</button><hr><button type="button" data-theme-action="template-css">旧版 CSS 模板</button><button type="button" data-theme-action="export-css">仅导出 CSS 变量</button>',{iconName:'folder'})}</div></div><div class="theme-grid">${themes.map(theme=>`<article class="theme-card ${prefs.selected===theme.id?'is-selected':''}"><button class="theme-choice" data-theme-id="${esc(theme.id)}" aria-pressed="${prefs.selected===theme.id}" ${busy||pending?'disabled':''}><span class="theme-preview" ${swatches(theme)} aria-hidden="true"><i class="theme-preview-rail"></i><i class="theme-preview-panel"><b></b><b></b><b></b></i><span class="theme-preview-sample"><strong>材料 · Materials</strong><small>结构、性能与研究记录</small><span>${icon('assistant',theme.icons)}${icon('folder',theme.icons)}${icon('chart',theme.icons)}</span></span></span><span class="theme-card-name"><strong>${esc(theme.name)}</strong><small>${prefs.selected===theme.id?pending?'预览中':'✓ 使用中':theme.tokens['--theme-mode']==='dark'?'深色':'浅色'}</small></span><span class="theme-card-description">${esc(theme.description)}</span></button>${theme.custom&&!pending?`<button class="theme-delete" data-theme-remove="${esc(theme.id)}" aria-label="删除主题 ${esc(theme.name)}" title="删除这个自定义主题">${icon('close')}</button>`:''}</article>`).join('')}</div>${fontSettings()}<p id="theme-resource-status" class="theme-format-note" role="status">${esc(runtime.status())}</p><p class="theme-format-note">支持版本 2 的 .mtheme.json 完整主题包，以及旧版 :root CSS 变量文件。完整包可内嵌字体和声明式 SVG 图标；无需保留源文件。</p><div class="modal-footer">${pending?'<button class="text-button" data-theme-action="cancel-preview">取消预览</button><button class="primary" data-theme-action="apply-import">应用并保存主题</button>':'<button class="text-button" data-theme-action="reset">恢复默认主题</button><button class="primary" data-action="close-modal">完成</button>'}</div>`,'themes');
  requestAnimationFrame(()=>{const grid=document.querySelector('.theme-grid'),card=grid?.querySelector('.is-selected');if(grid&&card){const g=grid.getBoundingClientRect(),r=card.getBoundingClientRect();if(r.bottom>g.bottom)grid.scrollTop+=r.bottom-g.bottom+6;}});
 }
 async function save(next){if(busy)return false;busy=true;const ticket=epoch;try{const clean=cleanThemePreferences(next);await config.persist(clean);if(ticket!==epoch)return false;preferences=clean;pending=null;apply();return true;}finally{busy=false;}}
 function cancelPreview(){if(!pending)return;pending=null;apply();}
 async function importFiles(files){
  if(!files.length||busy)return;busy=true;const ticket=epoch,revision=++importRevision;
  try{const rows=[];for(const file of files){if(!/\.(css|json)$/i.test(file.name))throw new Error('请选择 .mtheme.json 或 .css 主题文件。');if(file.size>(/\.css$/i.test(file.name)?32768:MAX_THEME_BYTES))throw new Error(`${file.name} 超过允许大小。`);rows.push({name:file.name,text:await file.text()});}
   const next=importThemeFiles(preferences,rows,()=>`custom-${crypto.randomUUID()}`);
   // Decode every supplied font before displaying or persisting any theme in the batch.
   for(const row of rows){const imported=importThemeFiles({},[row],()=> 'custom-validation');await validateThemeResources(resolveTheme(imported));}
   if(ticket!==epoch||revision!==importRevision)return;pending=next;apply();open();
  }finally{busy=false;}
 }
 document.querySelector('#theme-input').addEventListener('change',async event=>{const files=[...event.target.files];event.target.value='';try{await importFiles(files);}catch(error){config.toast(`主题未导入：${error.message}`,true);}});
 document.querySelector('#modal').addEventListener('close',()=>{importRevision++;cancelPreview();});
 document.addEventListener('input',event=>{if(event.target.matches('[data-theme-font-scale]')&&!busy&&!pending)applyFontScale(Number(event.target.value));});
 document.addEventListener('change',async event=>{
  if(event.target.matches('[data-theme-font-scale]')){
   if(busy||pending){applyFontScale(current().fontScale);return;}
   const controls=[...document.querySelectorAll('[data-theme-font],[data-theme-font-scale]')];controls.forEach(control=>control.disabled=true);
   try{if(await save({...preferences,fontScale:Number(event.target.value)})){const status=document.querySelector('#theme-font-status');if(status)status.textContent='字号已保存';}}
   catch(error){applyFontScale(preferences.fontScale);config.toast(`字号未更改：${error.message}`,true);}
   finally{controls.forEach(control=>control.disabled=false);}return;
  }
  const role=event.target.dataset.themeFont;if(!['body','heading','mono','numeric'].includes(role))return;if(busy||pending){event.target.value=preferences.fonts?.[role]||'theme';return;}
  const controls=[...document.querySelectorAll('[data-theme-font],[data-theme-font-scale]')];controls.forEach(control=>control.disabled=true);
  try{if(await save({...preferences,fonts:{...preferences.fonts,[role]:event.target.value}})){const status=document.querySelector('#theme-font-status');if(status)status.textContent='个人字体覆盖已保存';}}
  catch(error){event.target.value=preferences.fonts?.[role]||'theme';config.toast(`字体未更改：${error.message}`,true);}finally{controls.forEach(control=>control.disabled=false);}
 });
 document.addEventListener('click',async event=>{const button=event.target.closest('[data-theme-id],[data-theme-action],[data-theme-remove]');if(!button||button.disabled||busy)return;try{
  if(button.dataset.themeId){cancelPreview();if(await save({...preferences,selected:button.dataset.themeId}))open();}
  if(button.dataset.themeRemove){if(await save(removeTheme(preferences,button.dataset.themeRemove)))open();}
  const action=button.dataset.themeAction;
  if(action==='import')document.querySelector('#theme-input').click();
  if(action==='template')await config.saveText(themePackage(resolveTheme({selected:'ocean'})),'materia-theme-template.mtheme.json','json');
  if(action==='template-css')await config.saveText(themeCSS('我的学术主题',THEME_TOKENS),'materia-theme-template.css','css');
  if(action==='export'){const theme=resolveTheme(current());await config.saveText(themePackage(theme),`materia-theme-${theme.id}.mtheme.json`,'json');}
  if(action==='export-css'){const theme=resolveTheme(current());await config.saveText(themeCSS(theme.name,theme.tokens),`materia-theme-${theme.id}.css`,'css');}
  if(action==='reset'){cancelPreview();if(await save({...preferences,selected:'paper'})){open();config.toast('已恢复默认主题。');}}
  if(action==='reset-fonts'){if(await save({...preferences,fonts:{body:'theme',heading:'theme',mono:'theme',numeric:'theme'}})){open();document.querySelector('.theme-fonts').open=true;config.toast('字体已恢复跟随主题。');}}
  if(action==='reset-font-scale'){if(await save({...preferences,fontScale:100})){open();document.querySelector('.theme-fonts').open=true;config.toast('字号已恢复为 100%。');}}
  if(action==='cancel-preview'){cancelPreview();open();}
  if(action==='apply-import'&&pending){if(await save(pending)){open();config.toast('主题已应用并保存在本地文献库。');}}
 }catch(error){cancelPreview();open();config.toast(`主题未更改：${error.message}`,true);}});
 return{load,open,importFiles,getPreferences:()=>cleanThemePreferences(preferences),isBusy:()=>busy,ready:runtime.ready};
}
