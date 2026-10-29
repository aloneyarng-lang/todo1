import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {themePackage,resolveTheme} from '../../dist/theme-model.js';
import {validateThemeDesign} from '../../scripts/validate-theme-design.mjs';
const template=JSON.parse(await readFile(new URL('../../theme-template.mtheme.json',import.meta.url),'utf8'));
const theme=JSON.parse(themePackage(resolveTheme({selected:'steins-gate'})));
const pack={...template,...theme};validateThemeDesign(pack);
const target=new URL('./命运石之门-世界线.mtheme.json',import.meta.url);await writeFile(target,JSON.stringify(pack,null,2)+'\n');console.log(fileURLToPath(target));
