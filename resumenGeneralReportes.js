// resumenGeneralReportes.js — Módulo v3 para Resumen General
// Lista de opciones en Resumen, rango Desde/Hasta, reportes Simple/Detallado, comparativas y guardado de Excel en la app

export const OPCIONES_RESUMEN = [
  'Reporte Diario Simple',
  'Reporte Diario Detallado',
  'Reporte Semanal Simple / Detallado',
  'Reporte Mensual Simple / Detallado',
  'Reporte Trimestral Simple / Detallado',
  'Reporte 6 Meses Simple / Detallado',
  'Reporte 12 Meses Simple / Detallado',
  'Rango de Fechas Específico (Desde - Hasta)',
  'Comparativa de Periodos y Gráficas',
];

export const FORMATOS_HOJA = {
  CARTA: { id: 'carta', nombre: 'Hoja Carta (Letter)', cssSize: 'letter portrait' },
  OFICIO: { id: 'oficio', nombre: 'Hoja Oficio (Legal)', cssSize: 'legal portrait' },
};

export function filtrarPorRangoFecha(movimientos = [], fechaDesde, fechaHasta) {
  const desde = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
  const hasta = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

  return movimientos.filter((m) => {
    const f = new Date(m.fecha);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
}

export function generarResumenConRango({
  movimientos = [],
  opcionResumen = 'Rango de Fechas Específico (Desde - Hasta)',
  modoReporte = 'detallado', // 'simple' | 'detallado'
  formatoHoja = 'carta',
  fechaDesde,
  fechaHasta,
  comparativaAnterior = {},
}) {
  const filtrados =
    fechaDesde || fechaHasta
      ? filtrarPorRangoFecha(movimientos, fechaDesde, fechaHasta)
      : movimientos;

  const ingresos = filtrados
    .filter((m) => m.tipo === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const egresos = filtrados
    .filter((m) => m.tipo === 'egreso')
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const balanceNeto = ingresos - egresos;
  const anteriorNeto = Number(comparativaAnterior[opcionResumen]?.neto ?? balanceNeto * 0.9);
  const variacionAbs = balanceNeto - anteriorNeto;
  const variacionPct = anteriorNeto === 0 ? 0 : (variacionAbs / Math.abs(anteriorNeto)) * 100;

  const detalleProductos = filtrados
    .filter((m) => m.tipo === 'ingreso')
    .map((m) => ({
      fecha: m.fecha,
      producto: m.producto || 'Producto General',
      cantidadVendida: Number(m.cantidad || 1),
      metodoPago: m.metodoPago || 'No especificado',
      ingreso: Number(m.monto || 0),
      egresoAsociado: Number(m.egresoAsociado || 0),
    }));

  return {
    opcionResumen,
    modoReporte,
    rangoFechas: { fechaDesde: fechaDesde || null, fechaHasta: fechaHasta || null },
    formatoHoja: FORMATOS_HOJA[formatoHoja?.toUpperCase()] || FORMATOS_HOJA.CARTA,
    simple: { ingresos, egresos, balanceNeto },
    detallado: {
      ingresos,
      egresos,
      balanceNeto,
      cantidadProductosVendidos: detalleProductos.reduce((a, b) => a + b.cantidadVendida, 0),
      cantidadPagosRealizados: detalleProductos.length,
      items: detalleProductos,
    },
    comparativa: {
      netoActual: balanceNeto,
      netoAnterior: anteriorNeto,
      variacionAbs,
      variacionPct,
    },
  };
}

// Guarda el Excel en el historial interno de la aplicación (localStorage) para solicitarlo cuando deseen
export async function guardarYDescargarExcelEnApp(
  reporte,
  nombreArchivo = 'resumen_general_guardado.xlsx',
  storageKey = 'app_excels_resumen_general'
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const wsSimple = XLSX.utils.json_to_sheet([
    {
      Opcion_Resumen: reporte.opcionResumen,
      Modo: reporte.modoReporte,
      Formato_Hoja: reporte.formatoHoja.nombre,
      Fecha_Desde: reporte.rangoFechas.fechaDesde || 'Inicio',
      Fecha_Hasta: reporte.rangoFechas.fechaHasta || 'Actual',
      Ingresos: reporte.simple.ingresos,
      Egresos: reporte.simple.egresos,
      Balance_Neto: reporte.simple.balanceNeto,
      Neto_Anterior: reporte.comparativa.netoAnterior,
      Variacion_Absoluta: reporte.comparativa.variacionAbs,
      Variacion_Porcentual: `${reporte.comparativa.variacionPct.toFixed(1)}%`,
    },
  ]);
  XLSX.utils.book_append_sheet(wb, wsSimple, 'Resumen Simple');

  const filasDet = reporte.detallado.items.map((item) => ({
    Fecha: item.fecha,
    Producto_Vendido: item.producto,
    Cantidad_Producto: item.cantidadVendida,
    Pago_Realizado: item.metodoPago,
    Ingreso: item.ingreso,
    Egreso_Asociado: item.egresoAsociado,
    Neto: item.ingreso - item.egresoAsociado,
  }));
  const wsDet = XLSX.utils.json_to_sheet(
    filasDet.length ? filasDet : [{ Mensaje: 'Sin registros en el rango seleccionado' }]
  );
  XLSX.utils.book_append_sheet(wb, wsDet, 'Detallado Productos');

  const base64Xlsx = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const historialActual = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const registroGuardado = {
    id: `xls_${Date.now()}`,
    guardadoEn: new Date().toISOString(),
    nombreArchivo,
    opcionResumen: reporte.opcionResumen,
    rangoFechas: reporte.rangoFechas,
    base64Xlsx,
  };
  historialActual.unshift(registroGuardado);
  localStorage.setItem(storageKey, JSON.stringify(historialActual.slice(0, 50)));

  XLSX.writeFile(wb, nombreArchivo);
  return registroGuardado;
}

export function listarExcelsGuardadosEnApp(storageKey = 'app_excels_resumen_general') {
  return JSON.parse(localStorage.getItem(storageKey) || '[]');
}

export async function solicitarExcelGuardado(id, storageKey = 'app_excels_resumen_general') {
  const historial = listarExcelsGuardadosEnApp(storageKey);
  const encontrado = historial.find((item) => item.id === id);
  if (!encontrado) return null;

  const XLSX = await import('xlsx');
  const wb = XLSX.read(encontrado.base64Xlsx, { type: 'base64' });
  XLSX.writeFile(wb, encontrado.nombreArchivo);
  return encontrado;
}
