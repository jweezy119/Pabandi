import { Helmet } from 'react-helmet-async';

export function LocalBusinessJsonLd({ business }: { business: any }) {
  const url = `https://pabandi.com/business/${business.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name || 'Business',
    url,
    ...(business.phone ? { telephone: business.phone } : {}),
    address: business.address || business.city
      ? {
          '@type': 'PostalAddress',
          streetAddress: business.address,
          addressLocality: business.city,
          addressCountry: 'US',
        }
      : undefined,
    aggregateRating: business.rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: String(business.rating),
          reviewCount: Number(business.reviewCount || 0),
        }
      : undefined,
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
