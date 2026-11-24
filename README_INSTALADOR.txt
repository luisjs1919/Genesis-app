====================================================================
GÉNESIS — APLICACIÓN DE ESCRITORIO INSTALABLE (WINDOWS / MAC / LINUX)
====================================================================

1. CÓMO GENERAR EL INSTALADOR (.EXE / .DMG / .APPIMAGE):
   - En Windows: Haz doble clic en el archivo:
       GENERAR_INSTALADOR_WINDOWS.bat
     (O ejecuta en terminal: npm install && npm run dist:win)

   - En Mac / Linux: Ejecuta en terminal:
       ./GENERAR_INSTALADOR_MAC_LINUX.sh
     (O ejecuta: npm install && npm run desktop:installer)

2. DÓNDE QUEDA EL INSTALADOR LISTO PARA LLEVAR A CUALQUIER COMPUTADORA:
   - Dentro de la carpeta `dist/` se creará:
       * Windows: `Genesis-Instalador-30.2.0-Windows.exe`
       * Mac:     `Genesis-Instalador-30.2.0-Mac.dmg`
       * Linux:   `Genesis-Instalador-30.2.0-Linux.AppImage` (y `.deb`)

3. INSTALACIÓN EN CUALQUIER OTRA PC:
   - Copia únicamente el archivo `Genesis-Instalador-30.2.0-Windows.exe` a un pendrive
     o envíalo a la otra computadora.
   - La computadora destino NO necesita tener Node.js ni código fuente instalado.
   - Al ejecutar el instalador se crea el acceso directo "Genesis" en el Escritorio
     y en el Menú Inicio, funcionando 100% local con su propio libro Excel en
     la carpeta de datos del usuario.
