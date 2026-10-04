import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Root error boundary with chunk-load recovery.
 *
 * WHY THIS EXISTS
 * Before route-level code splitting the whole app was one bundle, so a failed load could not
 * leave a page half-alive: either the script ran or it did not. There are now ~258 chunks,
 * and a dynamic `import()` that fails (a blip, a CDN 404, a deploy that renamed a chunk while
 * a tab still held the old HTML) throws DURING RENDER.
 *
 * With no boundary at the root that throw propagated to the React root, unmounted the entire
 * tree, and left a blank page with nothing clickable and no way back — the user had to
 * hard-refresh. That is a real failure mode, and splitting introduced it.
 *
 * WHY THE RELOAD IS SAFE
 * A chunk-load failure means the HTML being served names chunks that no longer exist, which is
 * a stale-document problem: fetching the current index and booting from it fixes it. Guarded
 * by a sessionStorage flag so it can happen at most ONCE per session. Without that guard, a
 * deployment that is genuinely broken reloads the page forever, which is worse than the blank
 * screen it is replacing.
 */

/**
 * Recognise a dynamic-import failure.
 *
 * The browser messages differ by engine and are not a stable API, so this matches on shape
 * rather than exact text, and stays deliberately narrow: a genuine render bug must NOT be
 * treated as a stale bundle, or it would reload and mask itself.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /chunkloaderror/i.test(String((error as { name?: string })?.name ?? '')) ||
    /loading chunk \d+ failed/i.test(message)
  );
}

const RELOAD_FLAG = 'pabandi:chunk-reload';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  isReloading: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, isReloading: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, isReloading: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Left in the console rather than swallowed: the stack is the only way to find the
    // throwing component, and this boundary exists precisely so an error is no longer a
    // blank page with no diagnostics.
    console.error('[App] unhandled render error:', error, info.componentStack);
  }

  private handleChunkReload = () => {
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(RELOAD_FLAG) === '1';
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch {
      // Private mode / storage disabled. Fall through: the reload is still worth attempting
      // once, we simply cannot remember that we tried.
    }
    if (alreadyTried) return;
    this.setState({ isReloading: true });
    window.location.reload();
  };

  private handleRetry = () => {
    // Clear the guard so a genuinely retryable render error can re-attempt the chunk fetch.
    try {
      sessionStorage.removeItem(RELOAD_FLAG);
    } catch {
      /* non-fatal */
    }
    this.setState({ error: null, isReloading: false });
  };

  render() {
    const { error, isReloading } = this.state;
    if (!error) return this.props.children;

    if (isChunkLoadError(error)) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream, #F7F3EE)' }}>
          <div className="max-w-md text-center">
            <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--warm-ink, #2A2622)' }}>
              Loading the latest version
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--soft-stone, #8A8178)' }}>
              Part of this page could not be loaded, which usually means a new version was
              published while your tab was open. Reloading picks it up.
            </p>
            <button
              onClick={this.handleChunkReload}
              disabled={isReloading}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60"
              style={{ background: 'var(--clay, #C97B5A)', color: '#fff' }}
            >
              {isReloading ? 'Reloading…' : 'Reload'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cream, #F7F3EE)' }}>
        <div className="max-w-md text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(201,123,90,0.12)' }}
          >
            <span className="material-symbols-outlined text-[26px]" style={{ color: 'var(--terracotta, #C97B5A)' }}>
              error
            </span>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--warm-ink, #2A2622)' }}>
            This page ran into a problem
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--soft-stone, #8A8178)' }}>
            Something failed while drawing the page. The details are in your browser console.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--clay, #C97B5A)', color: '#fff' }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ border: '1px solid rgba(191,179,163,0.5)', color: 'var(--warm-ink, #2A2622)' }}
            >
              Go to home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
