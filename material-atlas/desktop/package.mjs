import { packager } from '@electron/packager';
import { mkdir, copyFile, writeFile, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeIcon } from './icon.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version,devDependencies} = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const stage = path.join(root, '.local', `desktop-stage-v${version}`);
const iconPath = await makeIcon();
await mkdir(path.join(stage, 'dist'), { recursive: true });
await mkdir(path.join(stage, 'desktop'), { recursive: true });
await copyFile(path.join(root,'dist','graph-cosmos.js'),path.join(stage,'dist','graph-cosmos.js'));
for (const file of ['agent-auth.js','study-model.js','study-client.js','reader-study.js','vocabulary-ui.js','study.css','ai-agent.js','ai-agent-core.js','ai-agent.css','agent-markdown.js','agent-history.js']) await copyFile(path.join(root,'dist',file),path.join(stage,'dist',file));
await copyFile(path.join(root,'desktop','agent.mjs'),path.join(stage,'desktop','agent.mjs'));
await copyFile(path.join(root,'desktop','agent-history.mjs'),path.join(stage,'desktop','agent-history.mjs'));
for (const file of ['index.html', 'app.js', 'research-canvas.js', 'research-canvas-model.js', 'research-canvas-render.js', 'research-canvas.css', 'icons.js', 'action-menus.js', 'ui-actions.css', 'theme-model.js', 'theme-runtime.js', 'theme-appearance.css', 'styles.css', 'workspace.css', 'figures.css', 'themes.css', 'themes.js', 'reader.js', 'reader-ui.js', 'reader-annotations.js', 'reader-annotations.css', 'reader-layout.js', 'reader.css', 'note-model.js', 'note-media.js', 'graph.js', 'graph.css', 'graph-view.js', 'graph-appearance.js', 'force-layout.js', 'graph-settings.js', 'associations.js', 'tags.js', 'removal.js', 'bulk-edit.js', 'paper-actions.js', 'paper-actions.css', 'journal-data.js', 'storage.js', 'palette.js', 'notes.js', 'note-links.js', 'catalog.js', 'related-papers.js', 'parameters.js', 'materials.js', 'measurements.js', 'parameter-index.js', 'chart-data.js', 'figure.js', 'markdown.js', 'import-plan.js', 'example-migration.js', 'batch-import.js', 'comparison.js', 'comparison-ui.js', 'material-selection.js', 'material-picker.js', 'material-picker.css', 'performance-editor.js', 'favicon.svg']) await copyFile(path.join(root, 'dist', file), path.join(stage, 'dist', file));
await mkdir(path.join(stage, 'dist', 'vendor'), {recursive:true});
for (const file of ['echarts.min.js','ECHARTS-LICENSE.txt','markdown-it.mjs','MARKDOWN-IT-LICENSE.txt','d3-force.mjs','D3-FORCE-LICENSE.txt']) await copyFile(path.join(root,'dist','vendor',file),path.join(stage,'dist','vendor',file));
await cp(path.join(root,'dist/vendor/pdfjs'),path.join(stage,'dist/vendor/pdfjs'),{recursive:true});
for (const file of ['translation.mjs','canvases.mjs','main.mjs', 'preload.cjs', 'library.mjs', 'materia.ico', 'agent-http.mjs', 'library-location.mjs']) await copyFile(path.join(root, 'desktop', file), path.join(stage, 'desktop', file));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'materia-desktop', productName: 'Materia', version, type: 'module', main: 'desktop/main.mjs', description: '材料文献星图 · 多材料性能对比与完整主题包' }, null, 2));
const paths = await packager({ dir: stage, name: 'Materia', executableName: 'Materia', platform: 'win32', arch: 'x64', out: path.join(root, 'release', `v${version}`), overwrite: false, asar: false, prune: false, icon: iconPath, electronVersion: devDependencies.electron, ...(process.env.MATERIA_ELECTRON_ZIP_DIR?{electronZipDir:path.resolve(process.env.MATERIA_ELECTRON_ZIP_DIR)}:{}), win32metadata: { CompanyName: 'Materia', FileDescription: 'Materia · 材料文献星图', ProductName: 'Materia' } });
for (const output of paths) {
  await cp(path.join(root,'theme-examples'),path.join(output,'theme-examples'),{recursive:true});
  await copyFile(path.join(root,'AI_AGENT.md'),path.join(output,'AI_AGENT.md'));
  for (const file of ['TRANSLATION.md','README.md', 'GRAPH_THEME_API.md', 'THEMES.md', 'RESEARCH_CANVAS.md', 'MATERIAL_COMPARISON.md', 'canvas-example.canvas.md', 'theme-template.css', 'theme-template.mtheme.json', 'DATA_IMPORT.md', 'metadata-template.md', 'metadata-template.json', 'journal-metrics-template.csv', 'journal-metrics-2025.csv']) await copyFile(path.join(root, file), path.join(output, file));
  await writeFile(path.join(output, '使用说明.txt'), '双击 Materia.exe 启动。\r\n请保留整个程序文件夹，不要单独移动 exe。\r\n文献默认保存在程序旁的「文献库」文件夹，可在「文献库与备份」中选择其他目录。\r\npapers 中保存原始 PDF，library.json 保存标题、标签、收藏夹与多条笔记。\r\n文献管理可离线运行，无需安装 Node.js。AI 研究助手需配置兼容服务的 API 地址、模型和密钥，详见 AI_AGENT.md。\r\n');
  console.log(path.join(output, 'Materia.exe'));
}
