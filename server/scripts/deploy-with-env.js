const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const envVars = [];
for (const line of envContent.split('\n')) {
  if (line.trim() && !line.startsWith('#')) {
    // some lines might have `=` in the value, so split only by first `=`
    const [key, ...rest] = line.split('=');
    let value = rest.join('=');
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (key !== 'PORT') {
      if (key === 'BACKEND_URL') {
        envVars.push(`BACKEND_URL=https://pabandi-backend-97129395003.asia-south1.run.app`);
      } else if (key === 'FRONTEND_URL') {
        envVars.push(`FRONTEND_URL=https://pabandi-42c5b.web.app`);
      } else {
        envVars.push(`${key}=${value}`);
      }
    }
  }
}

// Write to a YAML file for gcloud --env-vars-file
const yamlContent = envVars.map(ev => {
  const [key, ...rest] = ev.split('=');
  const val = rest.join('=');
  return `${key}: "${val.replace(/"/g, '\\"')}"`;
}).join('\n');

const yamlPath = path.join(__dirname, '../env.yaml');
fs.writeFileSync(yamlPath, yamlContent);

console.log('Deploying with env vars...');
try {
  const result = execSync('gcloud run deploy pabandi-backend --source . --region asia-south1 --allow-unauthenticated --project pabandi-42c5b --env-vars-file env.yaml', { stdio: 'inherit' });
  console.log('Deploy complete');
} catch (e) {
  console.error('Deploy failed', e);
}
