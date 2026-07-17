import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const stylesPath = path.join(root, 'site', 'css', 'styles.css');

if (!fs.existsSync(stylesPath)) {
  console.error('styles.css not found!');
  process.exit(1);
}

let content = fs.readFileSync(stylesPath, 'utf8');

// 1. Replace variables in :root
const oldRoot = `  :root {
    --bg: #060e09;
    --bg2: #0c1810;
    --bg3: #111f14;
    --bg4: #172818;
    --green: #22c55e;
    --green-dim: #16a34a;
    --green-glow: rgba(34,197,94,0.15);
    --gold: #f0b429;
    --gold-dim: rgba(240,180,41,0.15);
    --text: #e2ede5;
    --text-muted: #7a9982;
    --text-dim: #4a6651;
    --border: rgba(255,255,255,0.07);
    --border-green: rgba(34,197,94,0.2);
    --radius: 14px;
    --radius-lg: 22px;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }`;

const newRoot = `  :root {
    --bg: #060713;
    --bg2: #0b0d22;
    --bg3: #101330;
    --bg4: #171b3e;
    --green: #6366f1;
    --green-dim: #4f46e5;
    --green-glow: rgba(99,102,241,0.15);
    --gold: #f0b429;
    --gold-dim: rgba(240,180,41,0.15);
    --text: #f1f3f9;
    --text-muted: #8a95ab;
    --text-dim: #56627a;
    --border: rgba(255,255,255,0.07);
    --border-green: rgba(99,102,241,0.2);
    --radius: 14px;
    --radius-lg: 22px;
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
  }`;

content = content.replace(oldRoot, newRoot);

// 2. Replace all green rgb colors with indigo rgb
content = content.replaceAll('34,197,94', '99,102,241');

// 3. Replace all dark green rgb colors with dark indigo rgb
content = content.replaceAll('6,14,9', '6,7,19');

// 4. Replace dark green text on buttons with white text
content = content.replaceAll('color: #061208;', 'color: #ffffff;');

fs.writeFileSync(stylesPath, content, 'utf8');
console.log('Successfully updated site/css/styles.css to indigo theme!');
