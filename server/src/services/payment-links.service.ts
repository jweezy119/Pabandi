import { logger } from '../utils/logger';
import { prisma } from '../utils/database';

export interface PaymentLinkData {
  id: string;
  slug: string;
  title: string;
  description?: string;
  amount: number | null; // null means flexible/payer chooses
  currency: 'USD' | 'PKR' | 'USDC';
  merchantName: string;
  merchantId?: string;
  merchantWallet?: string;
  merchantRaastId?: string;
  merchantPhone?: string;
  trustScore: number;
  isShariaCompliant: boolean;
  isActive: boolean;
  allowCustomAmount: boolean;
  suggestedAmounts?: number[];
  redirectUrl?: string;
  createdAt: string;
}

const DEFAULT_SOLANA_VAULT = process.env.ESCROW_VAULT_ADDRESS || 'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';
const DEFAULT_RAAST_ID = process.env.RAAST_MERCHANT_ID || '03001234567';

class PaymentLinksService {
  private static instance: PaymentLinksService;
  private memoryLinks: Map<string, PaymentLinkData> = new Map();

  private constructor() {
    // Seed default showcase link
    this.createLink({
      slug: 'quick-escrow',
      title: 'Pabandi Verified Service Escrow',
      description: 'Funds held in 100% asset-backed, Sharia-compliant escrow until service fulfillment is confirmed.',
      amount: 100,
      currency: 'USD',
      merchantName: 'Pabandi Certified Merchant',
      merchantWallet: DEFAULT_SOLANA_VAULT,
      merchantRaastId: DEFAULT_RAAST_ID,
      trustScore: 820,
      allowCustomAmount: true,
      suggestedAmounts: [25, 50, 100, 250, 500],
    });
  }

  static getInstance(): PaymentLinksService {
    if (!PaymentLinksService.instance) {
      PaymentLinksService.instance = new PaymentLinksService();
    }
    return PaymentLinksService.instance;
  }

  createLink(params: {
    slug?: string;
    title: string;
    description?: string;
    amount?: number | null;
    currency?: 'USD' | 'PKR' | 'USDC';
    merchantName?: string;
    merchantId?: string;
    merchantWallet?: string;
    merchantRaastId?: string;
    merchantPhone?: string;
    trustScore?: number;
    allowCustomAmount?: boolean;
    suggestedAmounts?: number[];
    redirectUrl?: string;
  }): PaymentLinkData {
    const rawSlug = params.slug 
      ? params.slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-')
      : `link-${Date.now().toString(36)}`;

    const id = `plink_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const link: PaymentLinkData = {
      id,
      slug: rawSlug,
      title: params.title || 'Service Payment',
      description: params.description || 'Pabandi Escrow Protected Payment',
      amount: params.amount !== undefined ? params.amount : null,
      currency: params.currency || 'USD',
      merchantName: params.merchantName || 'Verified Merchant',
      merchantId: params.merchantId,
      merchantWallet: params.merchantWallet || DEFAULT_SOLANA_VAULT,
      merchantRaastId: params.merchantRaastId || DEFAULT_RAAST_ID,
      merchantPhone: params.merchantPhone || DEFAULT_RAAST_ID,
      trustScore: params.trustScore || 785,
      isShariaCompliant: true,
      isActive: true,
      allowCustomAmount: params.allowCustomAmount !== false,
      suggestedAmounts: params.suggestedAmounts || [20, 50, 100, 250],
      redirectUrl: params.redirectUrl,
      createdAt: new Date().toISOString(),
    };

    this.memoryLinks.set(link.slug, link);
    this.memoryLinks.set(link.id, link);
    logger.info(`[PaymentLinks] Created payment link slug='${link.slug}' (id=${link.id})`);
    return link;
  }

  /**
   * Resolves a link by slug or ID.
   * If not found in memory or database, dynamically creates an instant on-the-fly link
   * for zero-friction handle adoption (e.g. /pay/link/ali-roofing).
   */
  async resolveLink(slugOrId: string, queryParams?: Record<string, any>): Promise<PaymentLinkData> {
    const key = slugOrId.toLowerCase().trim();
    if (this.memoryLinks.has(key)) {
      return this.memoryLinks.get(key)!;
    }

    // Try resolving from business database
    try {
      const business = await prisma.business.findFirst({
        where: {
          OR: [
            { id: slugOrId },
            { slug: key },
            { name: { equals: slugOrId, mode: 'insensitive' } },
          ],
        },
      });

      if (business) {
        return this.createLink({
          slug: key,
          merchantId: business.id,
          merchantName: business.name,
          title: `Pay ${business.name}`,
          description: `Direct non-custodial booking and escrow payment to ${business.name}.`,
          merchantRaastId: business.raastId || DEFAULT_RAAST_ID,
          amount: queryParams?.amount ? Number(queryParams.amount) : null,
          currency: queryParams?.currency ? (queryParams.currency.toUpperCase() as any) : 'USD',
          trustScore: 810,
        });
      }
    } catch {
      // DB lookup fallback
    }

    // Zero-Configuration Instant Resolution for clean human handles
    const formattedName = key
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const dynamicAmount = queryParams?.amount ? Number(queryParams.amount) : null;
    const dynamicCurrency = queryParams?.currency ? (queryParams.currency.toUpperCase() as any) : 'USD';
    const dynamicTitle = queryParams?.title ? String(queryParams.title) : `${formattedName} Service Escrow`;
    const dynamicDesc = queryParams?.desc ? String(queryParams.desc) : `Escrow-protected payment to ${formattedName}. 100% refund guarantee if service is unfulfilled.`;

    return this.createLink({
      slug: key,
      merchantName: formattedName,
      title: dynamicTitle,
      description: dynamicDesc,
      amount: dynamicAmount,
      currency: dynamicCurrency,
      merchantWallet: queryParams?.wallet || DEFAULT_SOLANA_VAULT,
      merchantRaastId: queryParams?.raastId || DEFAULT_RAAST_ID,
      trustScore: 780,
    });
  }

  getAllLinks(): PaymentLinkData[] {
    const seen = new Set<string>();
    const list: PaymentLinkData[] = [];
    for (const link of this.memoryLinks.values()) {
      if (!seen.has(link.id)) {
        seen.add(link.id);
        list.push(link);
      }
    }
    return list;
  }
}

export const paymentLinksService = PaymentLinksService.getInstance();

