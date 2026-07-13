import { ReactNode } from 'react';
import { usePageSEO } from '../hooks/usePageSEO';

export function PublicSEO({ children, seo }: { children: ReactNode; seo?: { title?: string; description?: string; canonicalPath?: string; jsonLd?: Record<string, any> } }) {
  const { helmet } = usePageSEO(seo);
  return <>{helmet}{children}</>;
}
