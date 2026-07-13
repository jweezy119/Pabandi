import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

type SeoHeadProps = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  jsonLd?: string;
};

const DEFAULT_TITLE = 'Pabandi | Commitment, Secured.';
const DEFAULT_DESCRIPTION = 'Pabandi is the trust-and-commitment layer for the informal economy: local discovery, escrow-backed bookings, $PAB rewards, and portable Passport reputation.';

export function SeoHead({ title, description, canonicalPath, jsonLd }: SeoHeadProps) {
  const { pathname } = useLocation();
  const url = `https://pabandi.com${canonicalPath || pathname}`;

  return (
    <Helmet>
      <title>{title || DEFAULT_TITLE}</title>
      <meta name="description" content={description || DEFAULT_DESCRIPTION} />
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:image" content="https://pabandi.com/logo-company.jpg" />
      <meta name="twitter:url" content={url} />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content="https://pabandi.com/logo-company.jpg" />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
    </Helmet>
  );
}
