export interface ExcelSheetData {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

function xmlEscape(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colToLetter(colIndexZeroBased: number): string {
  let n = colIndexZeroBased + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoreZip(entries: Record<string, Uint8Array>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const names = Object.keys(entries);

  for (const fileName of names) {
    const data = entries[fileName];
    const nameBytes = encoder.encode(fileName);
    const crc = crc32Bytes(data);
    const size = data.length;

    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0x0021, true);
    lv.setUint16(12, 0x0021, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    localParts.push(lh, data);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0x0021, true);
    cv.setUint16(14, 0x0021, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    centralParts.push(ch);
    offset += lh.length + data.length;
  }

  const localTotal = localParts.reduce((s, p) => s + p.length, 0);
  const centralTotal = centralParts.reduce((s, p) => s + p.length, 0);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, names.length, true);
  ev.setUint16(10, names.length, true);
  ev.setUint32(12, centralTotal, true);
  ev.setUint32(16, localTotal, true);
  ev.setUint16(20, 0, true);

  const out = new Uint8Array(localTotal + centralTotal + 22);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

function buildWorksheetXml(sheet: ExcelSheetData): string {
  const allRows = [sheet.headers, ...sheet.rows];
  const rowXmls = allRows.map((row, rIdx) => {
    const rNum = rIdx + 1;
    const cellsXml = row
      .map((cell, cIdx) => {
        const ref = `${colToLetter(cIdx)}${rNum}`;
        if (typeof cell === 'number' && Number.isFinite(cell)) {
          return `<c r="${ref}"><v>${cell}</v></c>`;
        }
        const text = xmlEscape(cell ?? '');
        return `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
      })
      .join('');
    return `<row r="${rNum}">${cellsXml}</row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXmls.join('')}</sheetData>
</worksheet>`;
}

export function generateXlsxBytes(sheets: ExcelSheetData[]): Uint8Array {
  const encoder = new TextEncoder();
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'Registro', headers: ['Dato'], rows: [] }];

  const sheetEntries = safeSheets.map((s, idx) => {
    const cleanName = (s.name || `Hoja${idx + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Hoja${idx + 1}`;
    return {
      id: idx + 1,
      rId: `rId${idx + 1}`,
      target: `worksheets/sheet${idx + 1}.xml`,
      path: `xl/worksheets/sheet${idx + 1}.xml`,
      name: cleanName,
      xml: buildWorksheetXml(s),
    };
  });

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetEntries
    .map(
      (s) =>
        `<Override PartName="/xl/${s.target}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId0" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetEntries
      .map((s) => `<sheet name="${xmlEscape(s.name)}" sheetId="${s.id}" r:id="${s.rId}"/>`)
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetEntries
    .map(
      (s) =>
        `<Relationship Id="${s.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${s.target}"/>`
    )
    .join('\n  ')}
</Relationships>`;

  const zipMap: Record<string, Uint8Array> = {
    '[Content_Types].xml': encoder.encode(contentTypes),
    '_rels/.rels': encoder.encode(rootRels),
    'xl/workbook.xml': encoder.encode(workbookXml),
    'xl/_rels/workbook.xml.rels': encoder.encode(workbookRels),
  };

  for (const s of sheetEntries) {
    zipMap[s.path] = encoder.encode(s.xml);
  }

  return buildStoreZip(zipMap);
}
