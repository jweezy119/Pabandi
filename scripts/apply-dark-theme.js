const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'client', 'src');

const replacements = [
  // Backgrounds
  { from: /rgba\(12,\s*20,\s*38,/g, to: 'rgba(28,28,28,' },
  { from: /rgba\(8,\s*14,\s*30,/g, to: 'rgba(20,20,20,' },
  { from: /rgba\(6,\s*10,\s*18,/g, to: 'rgba(18,18,18,' },
  // Text colors
  { from: /#e8eef8/gi, to: '#e8e8e8' },
  { from: /#e2eaf6/gi, to: '#e8e8e8' },
  { from: /#8899bb/gi, to: '#9e9e9e' },
  { from: /#5e7a96/gi, to: '#757575' },
  { from: /#94a3b8/gi, to: '#9e9e9e' },
  { from: /#2d3f58/gi, to: '#616161' },
  { from: /#7a90a8/gi, to: '#9e9e9e' },
  { from: /#a0b4c8/gi, to: '#9e9e9e' },
  { from: /#050915/gi, to: '#0a0a0a' },
  // Neon accents (Blue to Cyan) - mostly for glows/borders
  { from: /rgba\(14,\s*165,\s*233,/g, to: 'rgba(0,229,255,' },
  // Logo fixes
  { from: /#2563eb.*#7c3aed/g, to: '#0ea5e9, #14b8a6' },
  { from: /#2563eb.*#1d4ed8/g, to: '#0ea5e9, #14b8a6' },
  { from: /#3b82f6.*#8b5cf6/g, to: '#0ea5e9, #14b8a6' },
];

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;

      for (const rule of replacements) {
        content = content.replace(rule.from, rule.to);
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated colors in: ${filePath.replace(srcDir, '')}`);
      }
    }
  }
}

console.log("Applying dark gray theme...");
walk(srcDir);
console.log("Done!");
