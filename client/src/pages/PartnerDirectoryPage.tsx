import { useState, useEffect } from 'react';
import { Surface, Badge, tokens } from '../design-system';

interface Partner {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  website?: string;
  integrationType: string;
  isFeatured: boolean;
  joinedAt: string;
}

export function PartnerDirectoryPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demoPartners: Partner[] = [
      { id: '1', name: 'MarketplacePro', description: 'OLX-style local marketplace with trust-weighted bidding', integrationType: 'trust-api', isFeatured: true, joinedAt: '2026-01-15' },
      { id: '2', name: 'FreelanceHub', description: 'Gig platform with portable reputation from Pabandi', integrationType: 'passport', isFeatured: true, joinedAt: '2026-02-01' },
      { id: '3', name: 'PropertyConnect', description: 'Rental platform with tenant screening via Trust Passport', integrationType: 'trust-api', isFeatured: false, joinedAt: '2026-03-10' },
      { id: '4', name: 'ClinicBooking', description: 'Healthcare appointment platform with no-show prediction', integrationType: 'escrow', isFeatured: false, joinedAt: '2026-04-05' },
    ];

    setPartners(demoPartners);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: tokens.color.background }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <Badge tone="info" className="mb-3">🤝 Partner Directory</Badge>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--warm-ink)] font-headline">
            Platforms Building on Pabandi
          </h1>
          <p className="mt-3 text-[var(--soft-stone)] max-w-2xl mx-auto">
            Every partner gets featured listing, co-marketing, and priority support.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--soft-stone)]">Loading partners...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map(partner => (
              <Surface key={partner.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--clay)] to-[var(--muted-ochre)] flex items-center justify-center text-white font-bold text-lg">
                    {partner.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-[var(--warm-ink)]">{partner.name}</h3>
                      {partner.isFeatured && (
                        <Badge tone="success" className="text-xs">Featured</Badge>
                      )}
                    </div>
                    <p className="text-sm text-[var(--soft-stone)] mb-3">{partner.description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-[var(--warm-sand)] text-[var(--warm-ink)]">
                        {partner.integrationType}
                      </span>
                      {partner.website && (
                        <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--clay)] hover:underline">
                          Visit site →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Surface>
            ))}
          </div>
        )}

        {/* CTA */}
        <Surface className="p-6 md:p-8 mt-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--warm-ink)] mb-3">Become a Partner</h2>
          <p className="text-sm text-[var(--soft-stone)] max-w-2xl mx-auto mb-4">
            Integrate the Trust API or use Pabandi escrow in your platform. Get featured in our directory and access co-marketing opportunities.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="mailto:jay@pabandi.com" className="no-underline">
              <Badge tone="info" className="cursor-pointer">Apply for Partnership →</Badge>
            </a>
            <Badge tone="success">Free for Beta Partners</Badge>
          </div>
        </Surface>
      </div>
    </div>
  );
}

export default PartnerDirectoryPage;
