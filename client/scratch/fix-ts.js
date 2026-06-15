const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/DeveloperPortalPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// The TIERS array definition currently looks something like:
// const TIERS = [
// ...
// ];
// We need to move it inside DeveloperPortalPage

const tiersRegex = /const TIERS = \[([\s\S]*?)\];/;
const tiersMatch = content.match(tiersRegex);

if (tiersMatch) {
  const tiersBlock = tiersMatch[0];
  // Remove it from the global scope
  content = content.replace(tiersBlock, '');

  // Insert it inside the component right after the state declarations
  const hookToFind = 'const [submitted, setSubmitted] = useState(false);';
  
  content = content.replace(hookToFind, hookToFind + '\n\n  ' + tiersBlock);
}

fs.writeFileSync(filePath, content);
console.log('Fixed TS error');
