const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'client', 'src', 'pages');
const compDir = path.join(__dirname, '..', 'client', 'src', 'components');

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Backgrounds
  content = content.replace(/bg-white/g, "bg-[#181818]");
  content = content.replace(/bg-slate-50/g, "bg-[#1a1a1a]");
  content = content.replace(/bg-slate-100/g, "bg-[#1a1a1a]");
  content = content.replace(/bg-gray-50/g, "bg-[#1a1a1a]");
  content = content.replace(/bg-gray-100/g, "bg-[#1a1a1a]");
  
  // Text colors
  content = content.replace(/text-slate-900/g, "text-[#e8e8e8]");
  content = content.replace(/text-slate-800/g, "text-[#e8e8e8]");
  content = content.replace(/text-slate-700/g, "text-[#9e9e9e]");
  content = content.replace(/text-slate-600/g, "text-[#757575]");
  content = content.replace(/text-slate-500/g, "text-[#616161]");
  
  content = content.replace(/text-gray-900/g, "text-[#e8e8e8]");
  content = content.replace(/text-gray-800/g, "text-[#e8e8e8]");
  content = content.replace(/text-gray-700/g, "text-[#9e9e9e]");
  content = content.replace(/text-gray-600/g, "text-[#757575]");
  content = content.replace(/text-gray-500/g, "text-[#616161]");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fixFile(filePath);
    }
  }
}

walk(srcDir);
walk(compDir);
console.log("Done fixing remaining tailwind classes.");
