!macro customInstall
  CreateShortCut "$DESKTOP\Genesis.lnk" "$INSTDIR\Genesis.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$DESKTOP\Genesis - Ventas.lnk" "$INSTDIR\Genesis.exe" "--ventas" "$INSTDIR\resources\icon.ico" 0
  CreateDirectory "$SMPROGRAMS\Genesis"
  CreateShortCut "$SMPROGRAMS\Genesis\Genesis.lnk" "$INSTDIR\Genesis.exe" "" "$INSTDIR\resources\icon.ico" 0
  CreateShortCut "$SMPROGRAMS\Genesis\Genesis - Ventas.lnk" "$INSTDIR\Genesis.exe" "--ventas" "$INSTDIR\resources\icon.ico" 0
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Genesis.lnk"
  Delete "$DESKTOP\Genesis - Ventas.lnk"
  RMDir /r "$SMPROGRAMS\Genesis"
!macroend
