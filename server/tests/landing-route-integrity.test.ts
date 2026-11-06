import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Landing Page Route & Integrity Audit', () => {
  const landingPagePath = path.resolve(__dirname, '../../client/src/pages/LandingPage.tsx');
  const previewWidgetPath = path.resolve(__dirname, '../../client/src/components/landing/LiveEscrowPreview.tsx');
  const appRoutesPath = path.resolve(__dirname, '../../client/src/App.tsx');

  it('ensures LandingPage.tsx and LiveEscrowPreview.tsx exist and have content', () => {
    expect(fs.existsSync(landingPagePath)).toBe(true);
    expect(fs.existsSync(previewWidgetPath)).toBe(true);

    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    const previewContent = fs.readFileSync(previewWidgetPath, 'utf8');

    expect(landingContent.length).toBeGreaterThan(100);
    expect(previewContent.length).toBeGreaterThan(100);
  });

  it('strictly prohibits "as any" typecasting in landing code', () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    const previewContent = fs.readFileSync(previewWidgetPath, 'utf8');

    expect(landingContent).not.toContain('as any');
    expect(previewContent).not.toContain('as any');
  });

  it('strictly prohibits hardcoded dark mode utility classes in LandingPage', () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    expect(landingContent).not.toContain('bg-gray-900');
    expect(landingContent).not.toContain('bg-black');
  });

  it('verifies all navigation links in LandingPage resolve to valid registered routes in App.tsx', () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    const appContent = fs.readFileSync(appRoutesPath, 'utf8');

    // Extract all `to="..."` and `navigate('...')` target paths
    const linkMatches = Array.from(landingContent.matchAll(/(?:to=|navigate\(['"])([^'"?#\s]+)/g)).map((m) => m[1]);
    expect(linkMatches.length).toBeGreaterThan(5);

    const uniqueLinks = Array.from(new Set(linkMatches));

    for (const link of uniqueLinks) {
      if (link === '/') continue;

      // Extract raw base route path (e.g. /p/estimate from /p/estimate/demo)
      const segments = link.split('/').filter(Boolean);
      const firstSegment = segments[0];

      // Verify either exact path match or segment match inside App.tsx
      const directRoutePattern = new RegExp(`path=["']/?${link.replace(/^\//, '')}["']`);
      const dynamicRoutePattern = new RegExp(`path=["']/?${firstSegment}`);
      const hasRoute = directRoutePattern.test(appContent) || dynamicRoutePattern.test(appContent);

      expect(
        hasRoute,
        `Route "${link}" linked in LandingPage.tsx must have a matching route registered in App.tsx`
      ).toBe(true);
    }
  });

  it('confirms the outcome-first H1 heading and Warm Clay palette alignment', () => {
    const landingContent = fs.readFileSync(landingPagePath, 'utf8');
    expect(landingContent).toContain('Guarantee Your');
    expect(landingContent).toContain('Next Project');
    expect(landingContent).toContain("Pay Only When");
    expect(landingContent).toContain("It's Done");
    expect(landingContent).toContain('THE SETTLEMENT & TRUST LAYER FOR HYBRID COMMERCE');
    expect(landingContent).toContain('LiveEscrowPreview');
  });
});
