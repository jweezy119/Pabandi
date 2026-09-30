import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export interface SocialLinks {
  twitter?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  website?: string;
  portfolio?: string;
  resume?: string;
  tiktok?: string;
  twitch?: string;
  discord?: string;
}

export interface PortfolioItem {
  title: string;
  description?: string;
  url?: string;
  type: 'project' | 'article' | 'video' | 'podcast' | 'open-source' | 'certificate';
  date?: string;
  tags?: string[];
}

export interface ProfileUpdate {
  displayName?: string;
  headline?: string;
  bio?: string;
  location?: string;
  websiteUrl?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  skills?: string[];
  socialLinks?: SocialLinks;
  portfolioItems?: PortfolioItem[];
  displayTheme?: string;
  showOnPublicProfile?: boolean;
  visibility?: string;
}

export class ProfileService {
  async getOrCreate(userId: string) {
    let passport = await prisma.trustPassport.findFirst({ where: { userId } });
    if (!passport) {
      const handle = `user-${userId.slice(0, 8)}`;
      passport = await prisma.trustPassport.create({
        data: {
          handle,
          displayName: 'Pabandi User',
          userId,
          visibility: 'PUBLIC',
        },
      });
    }
    return passport;
  }

  async update(userId: string, data: ProfileUpdate) {
    const passport = await this.getOrCreate(userId);

    const updateData: any = {};
    if (data.displayName) updateData.displayName = data.displayName;
    if (data.headline !== undefined) updateData.headline = data.headline;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.skills) updateData.skills = data.skills;
    if (data.socialLinks) updateData.socialLinks = data.socialLinks;
    if (data.portfolioItems) updateData.portfolioItems = data.portfolioItems;
    if (data.displayTheme) updateData.displayTheme = data.displayTheme;
    if (data.showOnPublicProfile !== undefined) updateData.showOnPublicProfile = data.showOnPublicProfile;
    if (data.visibility) updateData.visibility = data.visibility;

    return prisma.trustPassport.update({
      where: { id: passport.id },
      data: updateData,
    });
  }

  async getPublic(handle: string) {
    const passport = await prisma.trustPassport.findUnique({
      where: { handle },
      include: {
        endorsements: {
          include: {
            endorser: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!passport || !passport.showOnPublicProfile) return null;

    // Get attestations
    const attestations = await prisma.onchainAttestation.findMany({
      where: { passportId: passport.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      ...passport,
      attestations,
    };
  }

  async getPublicByUserId(userId: string) {
    const passport = await this.getOrCreate(userId);
    return this.getPublic(passport.handle);
  }
}

export const profileService = new ProfileService();