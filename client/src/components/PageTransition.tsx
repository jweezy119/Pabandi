import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [key, setKey] = useState(location.pathname);

  useEffect(() => {
    setKey(location.pathname);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div key={key} className="page-enter">
      {children}
    </div>
  );
}
