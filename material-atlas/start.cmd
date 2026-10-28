@echo off
cd /d "%~dp0"
if exist "release\v1.5.0\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.5.0\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.4.4\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.4.4\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.4.3\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.4.3\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.4.2\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.4.2\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.4.1\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.4.1\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.4.0\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.4.0\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.3.0\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.3.0\Materia-win32-x64\Materia.exe"
) else if exist "release\v1.2.0\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\v1.2.0\Materia-win32-x64\Materia.exe"
) else if exist "release\Materia-win32-x64\Materia.exe" (
  start "" "%~dp0release\Materia-win32-x64\Materia.exe"
) else if exist "node_modules\electron\dist\electron.exe" (
  start "" "%~dp0node_modules\electron\dist\electron.exe" "."
) else (
  echo Please run npm install, then npm start.
  pause
)
