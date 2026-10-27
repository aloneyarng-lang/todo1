import {actionMenu} from './action-menus.js';
export const THEME_TOKENS={
  '--paper':'#f7f7f2','--surface':'#fcfdf9','--canvas':'#fafcf7','--panel':'#f0f4ec','--sidebar':'#f1f4ed',
  '--ink':'#2e4843','--muted':'#718174','--line':'#dce5d7','--teal':'#285d59','--teal-light':'#e7efe3','--on-accent':'#ffffff',
  '--warning':'#9b7946','--warning-soft':'#f5efdf','--danger':'#a15d54','--danger-soft':'#f7ece8','--shadow':'#18362c1c',
  '--serif':`Georgia, 'Noto Serif SC', 'Songti SC', SimSun, serif`,'--sans':`Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif`,
  '--radius':'6px','--theme-mode':'light',
};
export const BUILTIN_THEMES=[
  {id:'paper',name:'学术纸白',description:'柔和纸底 · 松绿与黄铜',tokens:{}},
  {id:'academic-purple',name:'学术紫',description:'雾紫纸底 · 深紫与香槟金',tokens:{'--paper':'#f3f0f7','--surface':'#fffdfd','--canvas':'#fbf9fe','--panel':'#ede7f5','--sidebar':'#eee8f5','--ink':'#352c43','--muted':'#81758e','--line':'#ded5e9','--teal':'#705095','--teal-light':'#e8def3','--on-accent':'#ffffff','--warning':'#a48049','--warning-soft':'#f6efdf','--danger':'#a15b6c','--danger-soft':'#f9eaf0','--shadow':'#38204f18','--radius':'7px'}},
  {id:'ocean',name:'深海蓝',description:'冷白背景 · 海蓝与石板灰',tokens:{'--paper':'#edf2f6','--surface':'#fbfdff','--canvas':'#f4f8fc','--panel':'#e8f0f7','--sidebar':'#e7eef5','--ink':'#233f55','--muted':'#667e91','--line':'#d3e0eb','--teal':'#285f8a','--teal-light':'#deebf5','--warning':'#9b7642','--shadow':'#16374f1c'}},
  {id:'graphite',name:'石墨夜读',description:'深石墨背景 · 冰青与暖金',tokens:{'--paper':'#141c23','--surface':'#202c35','--canvas':'#18222a','--panel':'#26343e','--sidebar':'#1b262e','--ink':'#e0e9eb','--muted':'#a0b3bb','--line':'#3a4b55','--teal':'#8bc6be','--teal-light':'#304c4d','--on-accent':'#142c2b','--warning':'#dec087','--warning-soft':'#413827','--danger':'#e3aaa1','--danger-soft':'#453236','--shadow':'#00000055','--theme-mode':'dark'}},
  {id:'sand',name:'暖砂手稿',description:'暖砂纸底 · 赭石与墨棕',tokens:{'--paper':'#f2eee6','--surface':'#fdfaf4','--canvas':'#faf5eb','--panel':'#efe6d7','--sidebar':'#ede5d8','--ink':'#4c4236','--muted':'#887969','--line':'#ded1be','--teal':'#855e3e','--teal-light':'#eadcc8','--warning':'#916a35','--shadow':'#4935211c'}},
  {id:'wikipedia',name:'维基百科',description:'百科白底 · 蓝色链接与衬线标题',tokens:{'--paper':'#f8f9fa','--surface':'#ffffff','--canvas':'#ffffff','--panel':'#eaecf0','--sidebar':'#f8f9fa','--ink':'#202122','--muted':'#54595d','--line':'#c8ccd1','--teal':'#3366cc','--teal-light':'#eaf3ff','--warning':'#8a6000','--warning-soft':'#fef6e7','--danger':'#b32424','--danger-soft':'#fee7e6','--shadow':'#0000000a','--radius':'2px','--sans':`Arial, 'Microsoft YaHei', sans-serif`,'--serif':`'Linux Libertine', Georgia, 'Times New Roman', SimSun, serif`}},
];
export const FONT_OPTIONS=[
  {id:'theme',name:'跟随主题'},
  {id:'yahei',name:'微软雅黑',stack:`'Microsoft YaHei', 'PingFang SC', Arial, sans-serif`},
  {id:'dengxian',name:'等线',stack:`DengXian, 'Microsoft YaHei', Arial, sans-serif`},
  {id:'noto-sans',name:'思源黑体 / Noto Sans',stack:`'Source Han Sans SC', 'Noto Sans CJK SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif`},
  {id:'simsun',name:'宋体',stack:`SimSun, 'Songti SC', 'Noto Serif SC', serif`},
  {id:'noto-serif',name:'思源宋体 / Noto Serif',stack:`'Source Han Serif SC', 'Noto Serif CJK SC', 'Noto Serif SC', SimSun, serif`},
  {id:'kaiti',name:'楷体',stack:`KaiTi, STKaiti, SimSun, serif`},
  {id:'times',name:'Times New Roman',stack:`'Times New Roman', SimSun, serif`},
  {id:'georgia',name:'Georgia',stack:`Georgia, 'Noto Serif SC', SimSun, serif`},
  {id:'arial',name:'Arial',stack:`Arial, 'Microsoft YaHei', sans-serif`},
];
export const DEFAULT_THEME_PREFERENCES={selected:'paper',themes:[]};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const safeName=value=>String(value||'自定义主题').replace(/[\r\n\u0000-\u001f]/g,' ').trim().slice(0,60)||'自定义主题';
const colors=new Set(Object.keys(THEME_TOKENS).filter(key=>!['--serif','--sans','--radius','--theme-mode'].includes(key)));
function cleanToken(key,value){
  value=String(value).trim();
  if(!value||value.length>500||/[{};\\]|\/\*|\*\//.test(value))throw new Error(`主题变量 ${key} 的值不正确。`);
  if(colors.has(key)){
    if(!/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)&&! /^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]+\)$/i.test(value))throw new Error(`${key} 请使用十六进制、rgb() 或 hsl() 颜色。`);
  }else if(key==='--theme-mode'){
    if(!['light','dark'].includes(value))throw new Error('--theme-mode 只能填写 light 或 dark。');
  }else if(key==='--radius'){
    if(!/^(?:\d+(?:\.\d+)?)px$/.test(value)||parseFloat(value)>20)throw new Error('--radius 请填写 0px 至 20px。');
  }else if(!/^[\w\s'",\-\u0080-\uffff]+$/.test(value)||/["']/.test(value.replace(/"[^"\r\n]*"|'[^'\r\n]*'/g,'')))throw new Error(`${key} 请填写字体名称列表，例如 "Microsoft YaHei", sans-serif。`);
  return value;
}

// A deliberately small CSS format: named design tokens, never arbitrary layout rules.
export function parseThemeCSS(input,filename='自定义主题.css'){
  if(typeof input!=='string'||input.length>32768)throw new Error('主题 CSS 需为文本，大小不超过 32 KB。');
  const name=safeName(input.match(/\/\*\s*@name\s*:\s*([^*\r\n]+)\s*\*\//i)?.[1]||filename.replace(/\.css$/i,''));
  const text=input.replace(/^\uFEFF/,'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
  const block=text.match(/^:root\s*\{([^{}]*)\}\s*$/);
  if(!block)throw new Error('请使用主题模板：在 :root { … } 内填写 CSS 变量。暂不支持普通选择器、@import 或外部资源。');
  const tokens={};
  for(const declaration of block[1].split(';').map(part=>part.trim()).filter(Boolean)){
    const pair=declaration.match(/^(--[\w-]+)\s*:\s*([\s\S]+)$/);
    if(!pair||!own(THEME_TOKENS,pair[1]))throw new Error(`不支持的主题变量：${declaration.split(':')[0]}。请下载模板查看可用变量。`);
    tokens[pair[1]]=cleanToken(pair[1],pair[2]);
  }
  if(!Object.keys(tokens).length)throw new Error('主题中至少需要一个有效变量。');
  return{name,tokens};
}
export function themeCSS(name,tokens){
  const label=safeName(name).replace(/[*/]/g,'');
  return `/* @name: ${label} */\n/* Materia 主题：颜色、字体、圆角；只修改 :root 中的变量。 */\n:root {\n${Object.entries(tokens).filter(([key])=>own(THEME_TOKENS,key)).map(([key,value])=>`  ${key}: ${cleanToken(key,value)};`).join('\n')}\n}\n`;
}
export function cleanThemePreferences(value){
  const themes=[],ids=new Set();
  if(value&&Array.isArray(value.themes))for(const row of value.themes.slice(0,20)){
    if(!row||!/^custom-[a-z\d-]{1,80}$/i.test(row.id)||ids.has(row.id))continue;
    try{const parsed=parseThemeCSS(row.css,row.name);const name=safeName(row.name||parsed.name);themes.push({id:row.id,name,css:themeCSS(name,parsed.tokens)});ids.add(row.id);}catch{}
  }
  const selected=BUILTIN_THEMES.some(theme=>theme.id===value?.selected)||ids.has(value?.selected)?value.selected:'paper';
  const fonts={body:FONT_OPTIONS.some(f=>f.id===value?.fonts?.body)?value.fonts.body:'theme',heading:FONT_OPTIONS.some(f=>f.id===value?.fonts?.heading)?value.fonts.heading:'theme'};
  return{selected,themes,...(fonts.body!=='theme'||fonts.heading!=='theme'?{fonts}:{})};
}
function fontTokens(preferences,tokens){const result={...tokens};for(const [role,key] of [['body','--sans'],['heading','--serif']]){const font=FONT_OPTIONS.find(f=>f.id===preferences.fonts?.[role]);if(font?.stack)result[key]=font.stack;}return result;}
export function resolveTheme(preferences){
  const prefs=cleanThemePreferences(preferences),base=BUILTIN_THEMES.find(theme=>theme.id===prefs.selected);
  if(base)return{...base,tokens:fontTokens(prefs,{...THEME_TOKENS,...base.tokens}),custom:false};
  const custom=prefs.themes.find(theme=>theme.id===prefs.selected),parsed=parseThemeCSS(custom.css,custom.name);
  return{id:custom.id,name:custom.name,description:'导入的 CSS 主题',tokens:fontTokens(prefs,{...THEME_TOKENS,...parsed.tokens}),custom:true};
}
export function importThemeFiles(preferences,files,newId){
  if(!Array.isArray(files)||!files.length)throw new Error('请选择 CSS 主题文件。');
  const next=cleanThemePreferences(preferences);let lastId='';
  // Validate the entire batch before creating a next state.
  const parsed=files.map(file=>{try{return parseThemeCSS(file.text,file.name);}catch(error){throw new Error(`${file.name}：${error.message}`);}});
  for(const theme of parsed){const existing=next.themes.find(row=>row.name.toLocaleLowerCase()===theme.name.toLocaleLowerCase()),id=existing?.id||newId();const row={id,name:theme.name,css:themeCSS(theme.name,theme.tokens)};if(existing)Object.assign(existing,row);else next.themes.push(row);lastId=id;}
  if(next.themes.length>20)throw new Error('最多保存 20 个自定义主题，请先删除一些。');
  next.selected=lastId;return cleanThemePreferences(next);
}
export function removeTheme(preferences,id){const next=cleanThemePreferences(preferences);next.themes=next.themes.filter(row=>row.id!==id);if(next.selected===id)next.selected='paper';return next;}

export function createThemeController(config){
  let preferences=cleanThemePreferences(),busy=false;const esc=config.escape;
  function apply(){
    const theme=resolveTheme(preferences),root=document.documentElement;
    for(const[key,value]of Object.entries(theme.tokens))root.style.setProperty(key,value);
    root.dataset.theme=theme.id;root.dataset.themeMode=theme.tokens['--theme-mode'];root.style.colorScheme=theme.tokens['--theme-mode'];
    const button=document.querySelector('#ribbon-theme');if(button){button.title=`主题：${theme.name}`;button.setAttribute('aria-label',`主题切换，当前${theme.name}`);}
    requestAnimationFrame(()=>config.changed?.());return theme;
  }
  function load(value){preferences=cleanThemePreferences(value);apply();}
  const swatches=theme=>{const t=theme.tokens;return `style="--preview-bg:${esc(t['--paper'])};--preview-surface:${esc(t['--surface'])};--preview-accent:${esc(t['--teal'])};--preview-ink:${esc(t['--ink'])};--preview-line:${esc(t['--line'])}"`;};
  function fontSettings(){
    const options=role=>FONT_OPTIONS.map(font=>`<option value="${font.id}" ${(preferences.fonts?.[role]||'theme')===font.id?'selected':''}>${esc(font.name)}</option>`).join('');
    return `<section class="theme-fonts" aria-label="字体设置"><div class="theme-fonts-heading"><strong>字体</strong><button class="text-button" data-theme-action="reset-fonts">恢复跟随主题</button></div><div class="theme-font-selects"><label>界面与正文<select data-theme-font="body" aria-label="界面与正文字体">${options('body')}</select></label><label>文献与页面标题<select data-theme-font="heading" aria-label="文献与页面标题字体">${options('heading')}</select></label></div><div class="theme-font-preview"><strong>材料的结构与性能 · Structure &amp; Properties</strong><p>在文献之间建立关联，记录你的研究思考。Materials connect ideas.</p></div><small>即时生效，字体选择在切换主题时保留。使用电脑已安装字体；缺少字体时自动采用后备字体。PDF 原文与科研图导出保持原有字体。</small><span id="theme-font-status" role="status"></span></section>`;
  }
  function open(){
    const themes=[...BUILTIN_THEMES.map(theme=>({...theme,tokens:{...THEME_TOKENS,...theme.tokens}})),...preferences.themes.map(row=>({...row,description:'导入的 CSS 主题',custom:true,tokens:resolveTheme({...preferences,selected:row.id}).tokens}))];
    config.showModal('主题与外观','切换后即时生效，并保存在当前本地文献库。',`<div class="theme-intro"><p>选择一套适合阅读的配色，或导入自己的 CSS 变量主题。科研图导出始终保持白底。</p><div class="theme-tools"><button class="primary" data-theme-action="import">导入 CSS 主题</button>${actionMenu('theme-file-menu','主题文件','<button type="button" data-theme-action="template">下载 CSS 模板</button><button type="button" data-theme-action="export">导出当前主题 CSS</button>',{iconName:'folder'})}</div></div>${fontSettings()}<div class="theme-grid">${themes.map(theme=>`<article class="theme-card ${preferences.selected===theme.id?'is-selected':''}"><button class="theme-choice" data-theme-id="${esc(theme.id)}" aria-pressed="${preferences.selected===theme.id}" ${busy?'disabled':''}><span class="theme-preview ${theme.id==='wikipedia'?'theme-preview-wiki':''}" ${swatches(theme)} aria-hidden="true"><i class="theme-preview-rail"></i><i class="theme-preview-panel"><b></b><b></b><b></b></i><i class="theme-preview-dot d1"></i><i class="theme-preview-dot d2"></i><i class="theme-preview-dot d3"></i><i class="theme-preview-dot d4"></i>${theme.id==='wikipedia'?'<i class="theme-preview-article"><strong>Materia</strong><em>材料 · 结构 · 性能</em><b></b><b></b><b></b></i>':''}</span><span class="theme-card-name"><strong>${esc(theme.name)}</strong><small>${preferences.selected===theme.id?'✓ 使用中':theme.tokens['--theme-mode']==='dark'?'深色':'浅色'}</small></span><span class="theme-card-description">${esc(theme.description)}</span></button>${theme.custom?`<button class="theme-delete" data-theme-remove="${esc(theme.id)}" aria-label="删除主题 ${esc(theme.name)}" title="删除这个自定义主题">×</button>`:''}</article>`).join('')}</div><p class="theme-format-note">CSS 模板支持配色、字体和圆角。导入内容只应用这些变量，不支持改变布局的普通选择器或外部资源。同名自定义主题再次导入会更新；最多保存 20 套。</p><div class="modal-footer"><button class="text-button" data-theme-action="reset">恢复默认主题</button><button class="primary" data-action="close-modal">完成</button></div>`,'themes');
    requestAnimationFrame(()=>{const grid=document.querySelector('.theme-grid'),card=grid?.querySelector('.theme-card.is-selected');if(!grid||!card)return;const g=grid.getBoundingClientRect(),r=card.getBoundingClientRect();if(r.bottom>g.bottom-6)grid.scrollTop+=r.bottom-g.bottom+6;else if(r.top<g.top+6)grid.scrollTop-=g.top+6-r.top;});
  }
  async function save(next){if(busy)return false;busy=true;try{const clean=cleanThemePreferences(next);await config.persist(clean);preferences=clean;apply();return true;}finally{busy=false;}}
  async function importFiles(files){if(!files.length)return;const rows=[];for(const file of files){if(!/\.css$/i.test(file.name))throw new Error('请选择 .css 主题文件。');if(file.size>32768)throw new Error(`${file.name} 超过 32 KB。`);const text=await file.text(),parsed=parseThemeCSS(text,file.name);for(const[key,value]of Object.entries(parsed.tokens)){const property=key==='--theme-mode'?'color-scheme':key==='--radius'?'border-radius':['--sans','--serif'].includes(key)?'font-family':'color';if(!CSS.supports(property,value))throw new Error(`${file.name}：${key} 的 CSS 值无法识别。`);}rows.push({name:file.name,text});}const next=importThemeFiles(preferences,rows,()=>`custom-${crypto.randomUUID()}`);if(await save(next)){open();config.toast(`已导入并应用主题「${resolveTheme(preferences).name}」`);}}
  document.querySelector('#theme-input').addEventListener('change',async event=>{const files=[...event.target.files];event.target.value='';try{await importFiles(files);}catch(error){config.toast(error.message,true);}});
  document.addEventListener('change',async event=>{
    const role=event.target.dataset.themeFont;if(!['body','heading'].includes(role))return;
    if(busy){event.target.value=preferences.fonts?.[role]||'theme';return;}
    const controls=[...document.querySelectorAll('[data-theme-font]')];controls.forEach(control=>control.disabled=true);
    try{if(await save({...preferences,fonts:{body:preferences.fonts?.body||'theme',heading:preferences.fonts?.heading||'theme',[role]:event.target.value}})){const status=document.querySelector('#theme-font-status');if(status)status.textContent='字体已保存';}}
    catch(error){event.target.value=preferences.fonts?.[role]||'theme';config.toast(`字体未更改：${error.message}`,true);}
    finally{controls.forEach(control=>control.disabled=false);}
  });
  document.addEventListener('click',async event=>{const button=event.target.closest('[data-theme-id],[data-theme-action],[data-theme-remove]');if(!button||busy)return;try{
    if(button.dataset.themeId){if(await save({...preferences,selected:button.dataset.themeId}))open();}
    if(button.dataset.themeRemove){if(await save(removeTheme(preferences,button.dataset.themeRemove)))open();}
    const action=button.dataset.themeAction;
    if(action==='import')document.querySelector('#theme-input').click();
    if(action==='template')await config.saveText(themeCSS('我的学术主题',THEME_TOKENS),'materia-theme-template.css','css');
    if(action==='export'){const theme=resolveTheme(preferences);await config.saveText(themeCSS(theme.name,theme.tokens),`materia-theme-${theme.id}.css`,'css');}
    if(action==='reset'){if(await save({...preferences,selected:'paper'})){open();config.toast('已恢复默认主题。');}}
    if(action==='reset-fonts'){if(await save({...preferences,fonts:{body:'theme',heading:'theme'}})){open();config.toast('字体已恢复跟随主题。');}}
  }catch(error){config.toast(`主题未更改：${error.message}`,true);}});
  return{load,open,importFiles,getPreferences:()=>cleanThemePreferences(preferences)};
}
