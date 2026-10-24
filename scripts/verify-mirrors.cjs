const fs = require('fs');
const crypto = require('crypto');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const rootFiles = fs.readdirSync('.').filter(f => fs.statSync(f).isFile());
const assetFiles = fs.existsSync('assets') ? fs.readdirSync('assets') : [];

const pairs = rootFiles.filter(rf => assetFiles.includes(rf));

let mismatches = 0;
for (const f of pairs) {
  const h1 = sha256(f);
  const h2 = sha256(`assets/${f}`);
  if (h1 !== h2) {
    console.error(`MISMATCH: ${f} (${h1.slice(0, 8)}) !== assets/${f} (${h2.slice(0, 8)})`);
    mismatches++;
  }
}

if (mismatches === 0) {
  console.log(`ALL ${pairs.length} mirrored files match with 100% SHA-256 byte parity! ✓`);
} else {
  console.error(`Found ${mismatches} mismatches among ${pairs.length} mirrored files.`);
  process.exit(1);
}
