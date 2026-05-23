import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'js', 'main.js'), 'utf8');

const sectionIds = [...html.matchAll(/id="(biz-[^"]+|cust-[^"]+)"/g)].map((m) => m[1]);
const pageIds = [...html.matchAll(/id="(page-[^"]+)"/g)].map((m) => m[1].replace('page-', ''));

const onclickFns = [...html.matchAll(/onclick="([a-zA-Z]+)\(/g)].map((m) => m[1]);
const authJs = fs.existsSync(path.join(dir, 'js', 'auth.js'))
  ? fs.readFileSync(path.join(dir, 'js', 'auth.js'), 'utf8')
  : '';
const definedFns = [
  ...[js, authJs].join('\n').matchAll(/function ([a-zA-Z]+)\(/g),
].map((m) => m[1]);

const missingFns = [...new Set(onclickFns)].filter((f) => !definedFns.includes(f));
const scrollRefs = [...html.matchAll(/scrollToSection\('([^']+)'\)/g)].map((m) => m[1]);
const missingSections = scrollRefs.filter((id) => !html.includes(`id="${id}"`));

console.log('Pages:', pageIds.join(', '));
console.log('Sections:', sectionIds.join(', '));
if (missingFns.length) {
  console.error('Missing JS functions:', missingFns);
  process.exit(1);
}
if (missingSections.length) {
  console.error('Missing section IDs for scrollToSection:', missingSections);
  process.exit(1);
}
console.log('All onclick handlers and scroll targets OK');
