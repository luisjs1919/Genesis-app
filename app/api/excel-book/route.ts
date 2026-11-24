import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateXlsxBytes, type ExcelSheetData } from '@/lib/excelWorkbook';

export const runtime = 'nodejs';

const WORKBOOK_REL_PATH = path.join('data', 'genesis_libro_general.xlsx');

function getWorkbookFullPath(): string {
  const baseDir = process.env.GENESIS_USER_DATA_DIR || process.cwd();
  return path.join(baseDir, WORKBOOK_REL_PATH);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sheets: ExcelSheetData[] = Array.isArray(body?.sheets) ? body.sheets : [];
    const bytes = generateXlsxBytes(sheets);

    const fullPath = getWorkbookFullPath();
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, Buffer.from(bytes));

    return NextResponse.json({
      ok: true,
      file: WORKBOOK_REL_PATH.replace(/\\/g, '/'),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error guardando libro Excel en el proyecto:', err);
    return NextResponse.json(
      { ok: false, error: 'No se pudo escribir el archivo Excel en el proyecto.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const fullPath = getWorkbookFullPath();
    let buf: Buffer;
    if (fs.existsSync(fullPath)) {
      buf = fs.readFileSync(fullPath);
    } else {
      const defaultBytes = generateXlsxBytes([
        {
          name: 'Movimientos',
          headers: ['ID', 'Fecha', 'Comercio / Concepto', 'Categoría', 'Cuenta', 'Monto'],
          rows: [],
        },
      ]);
      buf = Buffer.from(defaultBytes);
    }

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="genesis_libro_general.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error leyendo libro Excel del proyecto:', err);
    return NextResponse.json(
      { ok: false, error: 'No se pudo leer el archivo Excel.' },
      { status: 500 }
    );
  }
}
