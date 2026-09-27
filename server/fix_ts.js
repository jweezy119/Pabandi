const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(__dirname + '/src', (filePath) => {
  if (filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/serviceBusinessId/g, 'businessId');
    content = content.replace(/crmServiceBusiness/g, 'crmBusiness');
    content = content.replace(/CrmServiceBusiness/g, 'CrmBusiness');
    content = content.replace(/actualDurationMinutes/g, 'durationMinutes');
    content = content.replace(/jobsCompleted:/g, '/*jobsCompleted:*/'); // remove orderBy jobsCompleted
    content = content.replace(/overallScore: \{ increment: 10 \} ,?/g, ''); // remove overallScore increment

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed', filePath);
    }
  }
});
