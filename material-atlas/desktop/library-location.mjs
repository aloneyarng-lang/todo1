import path from 'node:path';
import {existsSync} from 'node:fs';
export function resolveLibraryRoot({envRoot,configuredRoot,previousRoot,defaultRoot},exists=existsSync){
  if(envRoot)return envRoot;
  if(configuredRoot&&exists(path.join(configuredRoot,'library.json')))return configuredRoot;
  if(previousRoot&&exists(path.join(previousRoot,'library.json')))return previousRoot;
  return defaultRoot;
}
