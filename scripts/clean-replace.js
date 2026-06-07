const fs = require('fs');
const path = require('path');

const replacements = {
  'bg-white': 'bg-[#181818]',
  'bg-slate-50': 'bg-[#1a1a1a]',
  'bg-slate-100': 'bg-[#1a1a1a]',
  'bg-blue-50': 'bg-[#0ea5e915]',
  'bg-green-50': 'bg-[#10b98115]',
  'bg-emerald-50': 'bg-[#10b98115]',
  'bg-emerald-100': 'bg-[#10b98125]',
  'bg-red-50': 'bg-[#ef444415]',
  'bg-purple-50': 'bg-[#8b5cf615]',
  'bg-purple-100': 'bg-[#8b5cf625]',
  'bg-slate-200': 'bg-[#242424]',
  'text-slate-900': 'text-[#e8e8e8]',
  'text-slate-800': 'text-[#e8e8e8]',
  'text-slate-700': 'text-[#9e9e9e]',
  'text-slate-600': 'text-[#757575]',
  'text-slate-500': 'text-[#616161]',
  'text-blue-600': 'text-[#0ea5e9]',
  'text-blue-700': 'text-[#0ea5e9]',
  'text-blue-800': 'text-[#0ea5e9]',
  'text-emerald-700': 'text-[#10b981]',
  'text-emerald-600': 'text-[#10b981]',
  'text-green-700': 'text-[#10b981]',
  'text-red-700': 'text-[#ef4444]',
  'text-purple-700': 'text-[#8b5cf6]',
  'text-indigo-500': 'text-[#8b5cf6]',
  'border-slate-200': 'border-[#ffffff15]',
  'border-slate-300': 'border-[#ffffff25]',
  'border-blue-500': 'border-[#0ea5e955]',
  'border-blue-200': 'border-[#0ea5e933]',
  'border-green-200': 'border-[#10b98133]',
  'border-emerald-200': 'border-[#10b98133]',
  'border-red-200': 'border-[#ef444433]',
  'border-purple-200': 'border-[#8b5cf633]',
  'bg-surface-container-lowest': 'bg-[#0a0a0a]',
  'bg-surface-container-low': 'bg-[#1a1a1a]',
  'bg-surface-container': 'bg-[#242424]',
  'bg-surface-bright': 'bg-[#2e2e2e]',
  'bg-surface': 'bg-[#121212]',
  'text-on-surface-variant': 'text-[#a0a0a0]',
  'text-on-surface': 'text-[#e0e0e0]',
  'text-primary-fixed-dim': 'text-[#a0a0a0]',
  'text-primary': 'text-[#0ea5e9]',
};

function processFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');
  let newCode = code;
  
  // Sort replacements by length descending to avoid partial matches
  const keys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  
  for (const key of keys) {
    // Only replace if it's a standalone class (preceded by space/quote, followed by space/quote/etc)
    const regex = new RegExp(`(?<=["'\\s\`])${key}(?=["'\\s\`])`, 'g');
    newCode = newCode.replace(regex, replacements[key]);
  }
  
  if (code !== newCode) {
    fs.writeFileSync(filePath, newCode, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

const pagesDir = path.join(__dirname, '..', 'client', 'src', 'pages');
const compDir = path.join(__dirname, '..', 'client', 'src', 'components');

const walk = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) walk(fullPath);
    else if (fullPath.endsWith('.tsx')) processFile(fullPath);
  }
};

walk(pagesDir);
walk(compDir);
