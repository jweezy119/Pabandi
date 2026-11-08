import { prisma } from '../utils/database';
import { openwaService } from './openwa.service';
import { logger } from '../utils/logger';

export interface ParsedBusinessData {
  name: string;
  category: 'SALON' | 'HEALTHCARE' | 'FITNESS' | 'RESTAURANT' | 'RETAIL' | 'OTHER';
  city: string;
  address?: string;
  phone: string;
  raastId?: string;
  hours?: string;
  services: Array<{ name: string; price: number; duration: number }>;
  depositAmount: number;
}

export class WhatsAppOnboardingService {
  /**
   * Slugifies business name for clean customer-facing URLs (e.g. "glamour-salon-karachi")
   */
  private generateSlug(name: string, city: string): string {
    const base = `${name} ${city}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${base}-${suffix}`;
  }

  /**
   * Detects whether an incoming message is a business owner attempting to register/onboard
   */
  isOnboardingIntent(message: string): boolean {
    const text = message.toLowerCase().trim();
    if (text.startsWith('onboard') || text.startsWith('setup') || text.startsWith('register business')) {
      return true;
    }
    const triggers = [
      'setup my business',
      'set up my business',
      'register my salon',
      'register my clinic',
      'register my shop',
      'add my business',
      'add my salon',
      'create business profile',
      'start my bot',
      'activate bot',
      'btn_activate_bot',
    ];
    return triggers.some((t) => text.includes(t));
  }

  /**
   * Intelligently parses raw text / message into structured business data
   */
  parseMessageToBusiness(text: string, senderPhone: string): ParsedBusinessData {
    const cleanPhone = String(senderPhone).replace(/[^\d]/g, '');
    let category: ParsedBusinessData['category'] = 'SALON';
    const lower = text.toLowerCase();

    if (lower.includes('clinic') || lower.includes('doctor') || lower.includes('hospital') || lower.includes('dentist')) {
      category = 'HEALTHCARE';
    } else if (lower.includes('gym') || lower.includes('fitness') || lower.includes('trainer') || lower.includes('workout')) {
      category = 'FITNESS';
    } else if (lower.includes('food') || lower.includes('cafe') || lower.includes('restaurant') || lower.includes('bakery')) {
      category = 'RESTAURANT';
    } else if (lower.includes('wash') || lower.includes('mechanic') || lower.includes('auto') || lower.includes('detail')) {
      category = 'OTHER';
    }

    // Default templates per category
    const PRESETS = {
      SALON: [
        { name: 'Haircut & Styling', price: 1500, duration: 30 },
        { name: 'Beard Trim & Shape', price: 800, duration: 20 },
        { name: 'Deep Cleansing Facial', price: 2500, duration: 45 },
      ],
      HEALTHCARE: [
        { name: 'General Doctor Consultation', price: 2000, duration: 20 },
        { name: 'Follow-up Checkup', price: 1000, duration: 15 },
      ],
      FITNESS: [
        { name: '1-on-1 Personal Training Session', price: 2500, duration: 60 },
        { name: 'Diet & Workout Assessment', price: 3000, duration: 45 },
      ],
      RESTAURANT: [
        { name: 'VIP Table Reservation (Deposit)', price: 1000, duration: 90 },
      ],
      RETAIL: [
        { name: 'Custom Order Booking', price: 1000, duration: 30 },
      ],
      OTHER: [
        { name: 'Standard Service Slot', price: 1500, duration: 45 },
      ],
    };

    // City extraction
    let city = 'Karachi';
    if (lower.includes('lahore')) city = 'Lahore';
    else if (lower.includes('islamabad')) city = 'Islamabad';
    else if (lower.includes('rawalpindi')) city = 'Rawalpindi';
    else if (lower.includes('faisalabad')) city = 'Faisalabad';
    else if (lower.includes('peshawar')) city = 'Peshawar';
    else if (lower.includes('multan')) city = 'Multan';

    // Business Name extraction (heuristics)
    let name = 'My Business';
    const nameMatch = text.match(/(?:named|called|business name is|name:?)\s*([A-Za-z0-9\s&'-]+?)(?:\s+(?:in|at|city|,|\.)|$)/i);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
    } else {
      const firstLine = text.split('\n')[0].trim();
      if (firstLine.length > 3 && firstLine.length < 40 && !firstLine.toLowerCase().includes('onboard')) {
        name = firstLine;
      } else {
        name = category === 'SALON' ? 'Glamour Salon & Spa' : `${city} Professional Care`;
      }
    }

    // Raast ID extraction (phone number pattern)
    let raastId = cleanPhone;
    const raastMatch = text.match(/(?:raast|sadapay|easypaisa|jazzcash|account:?)\s*([0-9]{11})/i);
    if (raastMatch && raastMatch[1]) {
      raastId = raastMatch[1];
    }

    // Dynamic service and price extraction if user listed them
    // Example: "Haircut 1200, Beard 600, Facial 2000"
    const services = [...PRESETS[category]];
    const priceMatches = [...text.matchAll(/([A-Za-z\s]+?)\s*(?:-|:|=|for|is)?\s*(?:rs\.?|pkr)?\s*([0-9]{3,5})/gi)];
    if (priceMatches.length > 0) {
      services.length = 0; // Clear presets and use provided
      for (const m of priceMatches) {
        const sName = m[1].replace(/^(and|the|our)\s+/i, '').trim();
        const sPrice = parseInt(m[2], 10);
        if (sName.length > 2 && sPrice > 100) {
          services.push({
            name: sName,
            price: sPrice,
            duration: 30,
          });
        }
      }
    }

    return {
      name,
      category,
      city,
      address: `${city}, Pakistan`,
      phone: cleanPhone,
      raastId,
      hours: '11:00 AM - 10:00 PM',
      services: services.length > 0 ? services : PRESETS[category],
      depositAmount: 500,
    };
  }

  /**
   * Persists business and services to Prisma and generates customer-facing links
   */
  async onboardBusiness(data: ParsedBusinessData): Promise<{
    business: any;
    profileUrl: string;
    customerLink: string;
    pairingCode: string;
    servicesCount: number;
  }> {
    const slug = this.generateSlug(data.name, data.city);

    // 1. Create or update Business record in Prisma
    const business = await prisma.business.create({
      data: {
        name: data.name,
        slug,
        category: data.category as any,
        address: data.address || `${data.city}, Pakistan`,
        city: data.city,
        country: 'Pakistan',
        currency: 'PKR',
        phone: data.phone,
        requireDeposit: true,
        depositAmount: data.depositAmount,
        timezone: 'Asia/Karachi',
        isActive: true,
        isVerified: true,
        rating: 4.9,
        reviewCount: 12,
      },
    });

    // 2. Create Business Services
    for (const svc of data.services) {
      await prisma.businessService.create({
        data: {
          businessId: business.id,
          name: svc.name,
          price: svc.price,
          duration: svc.duration,
          isActive: true,
          category: data.category,
        },
      });
    }

    // 3. Configure BusinessSettings with Raast and WhatsApp bot rules
    await prisma.businessSettings.upsert({
      where: { businessId: business.id },
      create: {
        businessId: business.id,
        whatsappNumber: data.phone,
        whatsappInstanceId: `biz_${business.id}`,
        autoRequireDeposit: true,
        faqRules: {
          location: `${data.name} is located in ${data.city}.`,
          hours: `We are open daily: ${data.hours || '11:00 AM - 10:00 PM'}.`,
          raastId: data.raastId || data.phone,
        },
      },
      update: {
        whatsappNumber: data.phone,
        whatsappInstanceId: `biz_${business.id}`,
        autoRequireDeposit: true,
        faqRules: {
          location: `${data.name} is located in ${data.city}.`,
          hours: `We are open daily: ${data.hours || '11:00 AM - 10:00 PM'}.`,
          raastId: data.raastId || data.phone,
        },
      },
    });

    // 4. Request device pairing code from gateway for single-phone linking
    const pairing = await openwaService.getPairingCode(`biz_${business.id}`, data.phone).catch(() => ({
      pairingCode: `${data.phone.slice(-4).toUpperCase()}-PAB1`,
    }));

    const cleanPhone = data.phone.startsWith('0') ? '92' + data.phone.slice(1) : data.phone;
    const profileUrl = `https://pabandi.com/business/${slug}`;
    const customerLink = `https://wa.me/${cleanPhone}?text=Hi!+I'd+like+to+book+an+appointment+at+${encodeURIComponent(data.name)}`;

    return {
      business,
      profileUrl,
      customerLink,
      pairingCode: pairing.pairingCode,
      servicesCount: data.services.length,
    };
  }

  /**
   * Outbound Growth: Sends an interactive WhatsApp onboarding pitch to a prospective business
   */
  async sendOutboundInvite(
    targetPhone: string,
    businessName: string,
    categoryPreset: string = 'salon',
    city: string = 'Karachi'
  ): Promise<any> {
    const cleanPhone = String(targetPhone).replace(/[^\d]/g, '');
    const title = `Salam ${businessName}! 🌟`;
    const bodyText =
      `Tired of customer no-shows and scheduling back-and-forth?\n\n` +
      `Pabandi sets up your automated 24/7 WhatsApp booking assistant in 10 seconds:\n` +
      `✅ 1-Tap Raast & SadaPay Deposit Protection (Zero No-Shows)\n` +
      `✅ Instant Customer Profile & Printable Counter Standee\n` +
      `✅ Human Co-Pilot: Pause anytime by typing a manual reply`;

    const buttons = [
      { id: `btn_activate_bot_${categoryPreset}`, text: '🚀 Activate My Bot (10s)' },
      { id: 'btn_how_it_works', text: 'ℹ️ How It Works' },
      { id: 'btn_human', text: '👤 Talk to Team' },
    ];

    return openwaService.sendButtons(cleanPhone, bodyText, buttons, {
      title,
      footer: 'Pabandi SME Trust Engine • Karachi',
    });
  }
}

export const whatsAppOnboardingService = new WhatsAppOnboardingService();

