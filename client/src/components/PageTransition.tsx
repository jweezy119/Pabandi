import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    // Only jump to top on a real path change (ignore hash/query-only changes,
    // which should keep the user's scroll position — e.g. in-page anchors).
    if (prevPath.current !== location.pathname) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      prevPath.current = location.pathname;
    }
  }, [location.pathname, location.hash]);

  return (
    <div
      key={location.pathname}
      className="page-enter macos-fade"
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </div>
  );
}
