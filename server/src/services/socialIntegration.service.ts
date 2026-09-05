// ═══════════════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA INTEGRATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════
// Makes it easy for users to access the platform FROM social media
// and for the platform to access social media data.
//
// Key rails:
// - Instagram: venue pages, event flyers, DM automation, story sharing
// - TikTok: viral event clips, promoter content, guest check-ins
// - Twitter/X: event promotion, real-time updates, guest list drops
// - WhatsApp: confirmations, QR codes, deposit collection
// - Snapchat: geofilters, event stories, AR experiences
// ═══════════════════════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const socialIntegrationService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL LOGIN — One-click sign in with social platforms
  // ═══════════════════════════════════════════════════════════════════════════
  
  async connectSocialAccount(userId: string, platform: string, data: any) {
    return prisma.socialAccount.upsert({
      where: { userId_platform: { userId, platform } },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        username: data.username,
        profileUrl: data.profileUrl,
        followerCount: data.followerCount,
        connectedAt: new Date(),
      },
      create: {
        userId,
        platform,
        ...data,
      },
    });
  },

  async getSocialAccounts(userId: string) {
    return prisma.socialAccount.findMany({ where: { userId } });
  },

  async disconnectSocialAccount(userId: string, platform: string) {
    return prisma.socialAccount.delete({
      where: { userId_platform: { userId, platform } },
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL SHARING — One-click share from platform to social
  // ═══════════════════════════════════════════════════════════════════════════
  
  async shareToSocial(userId: string, platform: string, content: any) {
    const account = await prisma.socialAccount.findUnique({
      where: { userId_platform: { userId, platform } },
    });

    if (!account) return { error: 'Account not connected' };

    // In production: call platform APIs to post
    const shareUrls: Record<string, string> = {
      instagram: `https://www.instagram.com/create/story?text=${encodeURIComponent(content.text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.text)}&url=${encodeURIComponent(content.url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(content.text + ' ' + content.url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(content.url)}&text=${encodeURIComponent(content.text)}`,
    };

    // Track the share
    await prisma.socialShare.create({
      data: {
        userId,
        platform,
        contentType: content.type,
        referenceId: content.referenceId,
        shareUrl: shareUrls[platform] || '',
        status: 'SHARED',
      },
    });

    return { shareUrl: shareUrls[platform], platform };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL LOGIN OAUTH — Connect social accounts
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getOAuthUrl(platform: string, redirectUri: string) {
    const oauthUrls: Record<string, string> = {
      instagram: `https://api.instagram.com/oauth/authorize?client_id=${process.env.INSTAGRAM_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user_profile,user_media&response_type=code`,
      twitter: `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${process.env.TWITTER_CLIENT_ID}&redirect_uri=${redirectUri}&scope=tweet.read+users.read+offline.access&state=${Date.now()}`,
      facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${redirectUri}&scope=public_profile,email`,
    };

    return oauthUrls[platform] || null;
  },

  async handleOAuthCallback(platform: string, code: string, redirectUri: string) {
    // In production: exchange code for access token
    // Then fetch user profile and create/update social account
    return { success: true, platform };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL ANALYTICS — Track social performance
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getSocialStats(userId: string) {
    const accounts = await prisma.socialAccount.findMany({ where: { userId } });
    const shares = await prisma.socialShare.findMany({ where: { userId } });

    return {
      accounts: accounts.map((a: any) => ({
        platform: a.platform,
        username: a.username,
        followerCount: a.followerCount,
        connected: true,
      })),
      totalShares: shares.length,
      sharesByPlatform: shares.reduce((acc: any, s: any) => {
        acc[s.platform] = (acc[s.platform] || 0) + 1;
        return acc;
      }, {}),
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DEEP LINKS — Platform → Social and Social → Platform
  // ═══════════════════════════════════════════════════════════════════════════
  
  async generateDeepLink(type: string, id: string) {
    const baseUrl = 'https://pabandi.com';

    const deepLinks: Record<string, string> = {
      venue: `${baseUrl}/nightlife/venue/${id}`,
      event: `${baseUrl}/nightlife/event/${id}`,
      guestList: `${baseUrl}/nightlife/guest-list/${id}`,
      bottle: `${baseUrl}/nightlife/bottle/${id}`,
      booking: `${baseUrl}/booking/${id}`,
    };

    // Universal links that work in social media bios
    return {
      web: deepLinks[type] || baseUrl,
      // iOS Universal Link
      ios: `https://pabandi.com/app/${type}/${id}`,
      // Android App Link
      android: `https://pabandi.com/app/${type}/${id}`,
      // Custom scheme for mobile apps
      app: `pabandi://${type}/${id}`,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // QR CODE SOCIAL ENTRY — Scan to enter venue from social
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Generate a QR code that links to venue check-in page
  // When scanned from Instagram/TikTok story, opens Pabandi for entry
  async generateSocialEntryQR(venueId: string, eventId?: string) {
    const baseUrl = 'https://pabandi.com';
    const checkInUrl = eventId
      ? `${baseUrl}/nightlife/checkin/${venueId}?event=${eventId}`
      : `${baseUrl}/nightlife/checkin/${venueId}`;

    return {
      checkInUrl,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkInUrl)}`,
      venueId,
      eventId,
    };
  },
};
