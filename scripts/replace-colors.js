const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'client', 'src');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let changed = false;

      if (content.includes('#6C63FF') || content.includes('#6c63ff')) {
        content = content.replace(/#6[Cc]63[Ff]{2}/g, '#0ea5e9');
        changed = true;
      }
      if (content.includes('rgba(108, 99, 255') || content.includes('rgba(108,99,255')) {
        content = content.replace(/rgba\(108,\s*99,\s*255/g, 'rgba(14,165,233');
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated colors in: ${filePath}`);
      }
    }
  }
}

walk(srcDir);
console.log("All purple colors replaced with premium sky-blue!");
