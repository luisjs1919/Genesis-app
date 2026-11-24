# Paquete de Reemplazo V3 — Resumen General con Rango Desde/Hasta y Guardado en App

Incluye:
1. `Resumen_General_Reportes_Ingresos_Egresos-v3.xlsx`:
   - En la pestaña **Resumen General** incorpora lista desplegable de tipo de reporte, periodo predefinido, formato de hoja (**Carta / Oficio**), **Fecha Desde** (`B5`) y **Fecha Hasta** (`E5`), con cálculo automático en tiempo real usando `SUMIFS` / `COUNTIFS` sobre los registros detallados.
2. `resumenGeneralReportes.js`:
   - `OPCIONES_RESUMEN`: lista de opciones disponibles en el resumen.
   - `filtrarPorRangoFecha(...)` y `generarResumenConRango(...)`: soporte para rango específico Desde/Hasta y reportes Simple / Detallado.
   - `guardarYDescargarExcelEnApp(...)`, `listarExcelsGuardadosEnApp(...)` y `solicitarExcelGuardado(...)`: guarda el archivo Excel en el almacenamiento de la aplicación para descargarlo o solicitarlo cuando deseen.
