import { ReactNode } from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const DEFAULT_TITLE = 'Pabandi | Commitment, Secured.';
const DEFAULT_DESCRIPTION = 'Pabandi is the trust-and-commitment layer for the informal economy: local discovery, escrow-backed bookings, $PAB rewards, and portable Passport reputation.';
const BASE_URL = 'https://pabandi.com';

type PageSEOInput = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  jsonLd?: Record<string, any>;
};

type PageSEOReturn = {
  helmet: ReactNode;
  title: string;
  description: string;
  canonicalPath: string;
};

export function usePageSEO(input?: PageSEOInput): PageSEOReturn {
  const { pathname } = useLocation();
  const canonicalPath = input?.canonicalPath || pathname;
  const url = `${BASE_URL}${canonicalPath}`;
  const title = input?.title || DEFAULT_TITLE;
  const description = input?.description || DEFAULT_DESCRIPTION;
  const jsonLd = useMemo(() => {
    if (input?.jsonLd) return input.jsonLd;
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: BASE_URL,
      name: 'Pabandi',
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${BASE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };
  }, [input?.jsonLd]);

  const helmet = (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={`${BASE_URL}/logo-company.jpg`} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${BASE_URL}/logo-company.jpg`} />
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Pabandi',
        url: BASE_URL,
        logo: `${BASE_URL}/logo-company.jpg`,
        sameAs: ['https://x.com/PabandiGlobal']
      })}</script>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );

  return {
    helmet,
    title,
    description,
    canonicalPath: url
  };
}
