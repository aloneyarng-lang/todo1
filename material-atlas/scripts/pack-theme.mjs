import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {parseThemePackage} from '../dist/theme-model.js';
const [manifestFile,outputFile]=process.argv.slice(2);if(!manifestFile||!outputFile)throw new Error('用法：node scripts/pack-theme.mjs 源文件夹/manifest.json 输出.mtheme.json');
const source=path.resolve(manifestFile),base=await realpath(path.dirname(source)),manifest=JSON.parse(await readFile(source,'utf8'));
async function resource(file){if(typeof file!=='string'||path.isAbsolute(file))throw new Error('资源需使用源文件夹内的相对路径。');const target=await realpath(path.resolve(base,file)),relative=path.relative(base,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('资源路径超出主题源文件夹。');return readFile(target);}
for(const font of manifest.assets?.fonts||[]){if(font.file){font.data=(await resource(font.file)).toString('base64');delete font.file;}if(font.licenseFile){font.license=(await resource(font.licenseFile)).toString('utf8');delete font.licenseFile;}}
for(const[name,value]of Object.entries(manifest.icons?.overrides||{}))if(value?.file)manifest.icons.overrides[name]=JSON.parse((await resource(value.file)).toString('utf8'));
const theme=parseThemePackage(manifest);await writeFile(path.resolve(outputFile),JSON.stringify(theme,null,2)+'\n');console.log(`已打包 ${theme.name}：${theme.assets.fonts.length} 个字体，${Object.keys(theme.icons.overrides).length} 个自定义图标。`);
