import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AppErrorBoundary } from './AppErrorBoundary';

/**
 * Root error boundary.
 *
 * Route-level code splitting took this app from one bundle to ~258 chunks, and a dynamic
 * `import()` that fails throws DURING RENDER. With no boundary at the root that unmounted the
 * whole tree and left a blank page with nothing clickable and no way back but a hard refresh.
 *
 * The reload is guarded by a sessionStorage flag so it can fire at most once per session.
 * Without that guard, a genuinely broken deployment reloads forever, which is worse than the
 * blank screen it replaces — so that guard is the difference between a fix and a new trap.
 */

function Boom({ error }: { error: Error }) {
  throw error;
}

function renderBoundary(error: Error) {
  return render(
    <AppErrorBoundary>
      <Boom error={error} />
    </AppErrorBoundary>,
  );
}

const chunkError = () => new Error('Failed to fetch dynamically imported module: /assets/Page-abc.js');
const renderError = () => new Error('x is not a function');

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>content</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('shows a recoverable state for a render error, with a way back', () => {
    renderBoundary(renderError());
    expect(screen.getByText('This page ran into a problem')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByText('Go to home')).toBeTruthy();
  });

  it('offers a reload for a chunk-load failure, not a generic error', () => {
    renderBoundary(chunkError());
    // A stale bundle is a different problem with a different fix, so it gets its own copy and
    // its own action. Showing "something went wrong" here would send the user looking for a bug
    // that is not in the code they can see.
    expect(screen.getByText('Loading the latest version')).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
  });

  it('recognises the browser-specific chunk failure messages', () => {
    const messages = [
      'Failed to fetch dynamically imported module',
      'error loading dynamically imported module',
      'Importing a module script failed',
      'Loading chunk 42 failed',
    ];
    for (const message of messages) {
      cleanup();
      sessionStorage.clear();
      renderBoundary(new Error(message));
      expect(screen.getByText('Loading the latest version'), message).toBeTruthy();
    }
  });

  it('does NOT treat an ordinary render bug as a stale bundle', () => {
    renderBoundary(new Error('x is not a function'));
    // Reloading on a real bug would mask it and hide the stack from whoever has to fix it.
    expect(screen.queryByText('Loading the latest version')).toBeNull();
  });

  it('reloads at most once per session', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });

    renderBoundary(chunkError());
    screen.getByText('Reload').click();
    expect(reload, 'first failure should reload').toHaveBeenCalledTimes(1);

    // Simulate the tab recovering the new bundle but still hitting a bad import: the second
    // attempt must NOT reload again, or a bad deploy becomes an infinite reload loop.
    cleanup();
    sessionStorage.setItem('pabandi:chunk-reload', '1');
    renderBoundary(chunkError());
    screen.getByText('Reload').click();
    expect(reload, 'second failure must not reload again').toHaveBeenCalledTimes(1);
  });
});
