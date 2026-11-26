const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "components", "GenesisDashboard.tsx");

if (!fs.existsSync(targetFile)) {
  console.error("No se encontró components/GenesisDashboard.tsx");
  process.exit(1);
}

const original = fs.readFileSync(targetFile, "utf8");
const lines = original.split(/\r?\n/);

const idx = lines.findIndex((line) => line.includes('placeholder="Ej. J-40123456-7"'));

if (idx === -1) {
  console.log('No se encontró placeholder="Ej. J-40123456-7" en components/GenesisDashboard.tsx');
  process.exit(1);
}

const start = Math.max(0, idx - 15);
const end = Math.min(lines.length, idx + 15);

for (let i = start; i < end; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
