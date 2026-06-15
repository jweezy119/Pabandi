const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/routes/business.routes.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add getBusinessCustomers to imports
if (!content.includes('getBusinessCustomers')) {
  content = content.replace(
    'getBusinessReviews,\n  claimBusiness,',
    'getBusinessReviews,\n  claimBusiness,\n  getBusinessCustomers,'
  );
}

// 2. Add route definition
const routeStr = "router.get('/:id/analytics', getBusinessAnalytics);";
if (content.includes(routeStr) && !content.includes('/:id/customers')) {
  content = content.replace(
    routeStr,
    routeStr + "\nrouter.get('/:id/customers', getBusinessCustomers);"
  );
}

fs.writeFileSync(filePath, content);
console.log('business.routes.ts updated successfully.');
