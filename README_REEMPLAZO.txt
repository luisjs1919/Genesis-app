# Paquete de Reemplazo — Resumen General y Reportes de Ingresos y Egresos

Este ZIP contiene los archivos listos para reemplazar o integrar en tu flujo de trabajo:

1. `Resumen_General_Reportes_Ingresos_Egresos-v2.xlsx`
   - **Resumen General**: Panel ejecutivo con selector de formato (**Carta / Oficio**), selector de periodo (**Diario, Semanal, Mensual, Trimestral, 6 Meses, 12 Meses**), KPIs enlazados, tabla comparativa y gráficos.
   - **Reporte Simple**: Ingresos, egresos, resultado neto y bitácora diaria simplificada para todos los horizontes.
   - **Detallado Productos**: Qué producto se vendió, cantidad de producto vendida, tipo de pago realizado y egreso asociado, configurado para hoja **Oficio (Legal)**.
   - **Periodos y Comparativas**: Comparativa contra periodo anterior y serie mensual de 12 meses con gráficos.

2. `resumenGeneralReportes.js`
   - Función `construirResumenGeneral(...)` para generar las vistas **Simple** y **Detallado** en los 6 horizontes de tiempo y con formato **Carta** u **Oficio**.
   - Función `exportarReporteAExcel(...)` para generar y guardar el archivo `.xlsx` desde tu aplicación.
