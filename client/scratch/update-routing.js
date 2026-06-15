const fs = require('fs');
const path = require('path');

// --- APP.TSX ---
const appPath = path.join(__dirname, '../src/App.tsx');
let appContent = fs.readFileSync(appPath, 'utf-8');

if (!appContent.includes('BusinessCrmPage')) {
  appContent = appContent.replace(
    "import BusinessProfilePage from './pages/BusinessProfilePage';",
    "import BusinessProfilePage from './pages/BusinessProfilePage';\nimport BusinessCrmPage from './pages/BusinessCrmPage';"
  );
  
  const routeTarget = '<Route\n          path="business/settings"';
  appContent = appContent.replace(
    routeTarget,
    '<Route\n          path="business/crm"\n          element={isAuthenticated ? <BusinessCrmPage /> : <Navigate to="/login" />}\n        />\n        ' + routeTarget
  );
  fs.writeFileSync(appPath, appContent);
  console.log('App.tsx updated');
}

// --- LAYOUT.TSX ---
const layoutPath = path.join(__dirname, '../src/components/Layout.tsx');
let layoutContent = fs.readFileSync(layoutPath, 'utf-8');

// Desktop Nav
if (!layoutContent.includes('DesktopNavLink to="/business/crm"')) {
  const targetDesktop = "{user?.role === 'BUSINESS_OWNER' ? 'Dashboard' : 'Bookings'}\n                </DesktopNavLink>";
  layoutContent = layoutContent.replace(
    targetDesktop,
    targetDesktop + "\n                {user?.role === 'BUSINESS_OWNER' && (\n                  <DesktopNavLink to=\"/business/crm\" current={location.pathname === '/business/crm'}>\n                    CRM\n                  </DesktopNavLink>\n                )}"
  );
  
  // Mobile Nav
  const targetMobile = "<MobileTab \n              to={user?.role === 'BUSINESS_OWNER' ? '/dashboard' : '/reservations'}";
  layoutContent = layoutContent.replace(
    targetMobile,
    "{user?.role === 'BUSINESS_OWNER' && (\n              <MobileTab to=\"/business/crm\" icon=\"groups\" label=\"CRM\" current={location.pathname === '/business/crm'} />\n            )}\n            " + targetMobile
  );
  
  fs.writeFileSync(layoutPath, layoutContent);
  console.log('Layout.tsx updated');
}

