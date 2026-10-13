import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERTICAL_PRESETS } from './useBusinessSettings';

/**
 * What each kind of business can actually do.
 *
 * THE DEFECT THIS PREVENTS
 * `salon` shipped without `jobs`. A job is how a salon delivers a service — it is
 * the appointment — so the preset for a hair salon gave its owner no way to
 * schedule anything. `logistics` had the same gap, which is stranger still, because
 * FreightOS lists its loads straight out of /crm/jobs: the CRM had the feature
 * switched off in the module that owns the data.
 *
 * Neither announced itself. FeatureGate silently redirects a disabled route to
 * /contact and the sidebar filters the same list, so the two agreed the feature did
 * not exist. A person concluded the CRM was missing the feature. It was configured
 * to hide it.
 */

/** Verticals whose business is delivering a booked service. */
const SERVICE_DELIVERY = ['salon', 'trades', 'real_estate', 'logistics'];

/** True of any business, whatever it sells. */
const CORE = ['clients', 'deals', 'invoices', 'activities'];

describe('every preset supports the business it describes', () => {
  it.each(Object.keys(VERTICAL_PRESETS))('%s keeps the features any business has', (vertical) => {
    const features = VERTICAL_PRESETS[vertical].features.contact;
    for (const core of CORE) {
      expect(features, `${vertical} is missing ${core}`).toContain(core);
    }
  });

  it.each(SERVICE_DELIVERY)('%s can schedule the work it sells', (vertical) => {
    // Without jobs, /contact/jobs redirects to /contact with no message, and the
    // sidebar hides the entry — so the business looks like the product lacks it.
    expect(
      VERTICAL_PRESETS[vertical].features.contact,
      `${vertical} has no jobs, so it cannot book the service it sells`,
    ).toContain('jobs');
  });

  it.each(Object.keys(VERTICAL_PRESETS))('%s with jobs also has tasks', (vertical) => {
    // A job you cannot track the follow-up on is half a workflow.
    const features = VERTICAL_PRESETS[vertical].features.contact;
    if (features.includes('jobs')) {
      expect(features, `${vertical} has jobs but no tasks`).toContain('tasks');
    }
  });

  it('gives every preset a non-empty feature list', () => {
    for (const [vertical, preset] of Object.entries(VERTICAL_PRESETS)) {
      expect(preset.features.contact.length, `${vertical} enables nothing`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate features in any preset', () => {
    // Harmless on its own, but a duplicate usually means one was added without the
    // other being removed, which is how salon ended up without jobs at all.
    for (const [vertical, preset] of Object.entries(VERTICAL_PRESETS)) {
      const features = preset.features.contact;
      expect(new Set(features).size, `${vertical} repeats a feature`).toBe(features.length);
    }
  });
});

describe('an account that never ran the wizard', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/hooks/useBusinessSettings.ts'), 'utf8');

  it('still has jobs enabled by default', () => {
    // No vertical means no preset has been applied, so the default is what the
    // account runs on. It had no jobs, so /contact/jobs bounced anyone who had
    // not been through setup.
    // Comments sit between the key and the value now, so the match spans them.
    // Matches across the comment that now sits between the key and the value.
    const defaults = /enabledFeatures:\s*\{[\s\S]*?contact:\s*\[([^\]]*)\]/.exec(src);
    expect(defaults, 'could not find the default feature list').toBeTruthy();
    const features = defaults![1].split(',').map((f) => f.trim().replace(/'/g, ''));
    for (const f of ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks']) {
      expect(features, `the default is missing ${f}`).toContain(f);
    }
  });

  it('does not claim to persist something it does not', () => {
    // The store's own docblock says persistence must not be removed, because the
    // old ContactOSPage redirect depended on these flags. Cheap to check, and the
    // failure it prevents is silent.
    expect(src).toContain('persist(');
  });
});

describe('the nav and the routes are gated on the same list', () => {
  // Resolved from the project root: import.meta.url is a virtual path under vitest,
  // so joining from it produces /src/... rather than the real location.
  const root = process.cwd();
  const layout = readFileSync(join(root, 'src/components/DashboardLayout.tsx'), 'utf8');
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');

  it('every gated contact route names a feature that exists in a preset', () => {
    const gated = [...app.matchAll(/FeatureGate feature="([^"]+)"/g)].map((m) => m[1]);
    const known = new Set<string>();
    for (const preset of Object.values(VERTICAL_PRESETS)) {
      for (const f of preset.features.contact) known.add(f);
    }
    for (const feature of new Set(gated)) {
      // A FeatureGate on a name no preset ever enables hides that route for
      // everyone, permanently, and says nothing.
      expect(known.has(feature), `no preset enables "${feature}", so its route is dead`).toBe(true);
    }
  });

  it('the sidebar is gated on the same store', () => {
    // Two lists of the same thing is how they drift: one hides a nav entry while
    // the other still lets the route through, or the reverse.
    expect(layout).toContain('enabledFeatures');
  });
});