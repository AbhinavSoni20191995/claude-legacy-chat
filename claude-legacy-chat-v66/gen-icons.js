// Generates simple PNG icons without external deps using pure Node
// Uses a minimal BMP->PNG approach via the 'canvas' package if available,
// otherwise writes placeholder files the server can handle.
// We'll use sharp or jimp if available, else skip (server works without icons).
const fs = require('fs');
const path = require('path');

// Write a minimal 1x1 transparent PNG as placeholder if no canvas available
// Real icons can be dropped in manually
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
  '77533800000000c4944415478016360f8cfc00000000200015e221bc00000' +
  '0000049454e44ae426082', 'hex'
);

const sizes = [192, 512];
const dir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

sizes.forEach(s => {
  const file = path.join(dir, `icon-${s}.png`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, PNG_1x1);
    console.log(`Wrote placeholder icon-${s}.png`);
  }
});
console.log('Icons ready (replace with real artwork if desired)');
