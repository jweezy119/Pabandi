import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'pabandi-fallback-secret-2026';
const AUTH_CODE_EXPIRY_MINUTES = 5;
const ACCESS_TOKEN_EXPIRY_HOURS = 24;

export class OAuthService {
  /**
   * Validate if a client exists and the redirect URI is allowed.
   */
  async validateClientAndRedirect(clientId: string, redirectUri: string) {
    const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
    if (!client || !client.isActive) {
      throw new Error('Invalid or inactive client_id');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error('Invalid redirect_uri. Must match a registered URL.');
    }

    return client;
  }

  /**
   * Generate a short-lived authorization code for a user.
   */
  async generateAuthorizationCode(clientId: string, userId: string, redirectUri: string) {
    const code = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_CODE_EXPIRY_MINUTES);

    const authCode = await prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId,
        userId,
        redirectUri,
        expiresAt,
      }
    });

    logger.info(`[OAuth] Generated auth code for user ${userId} and client ${clientId}`);
    return authCode.code;
  }

  /**
   * Exchange an authorization code for an access token (and refresh token).
   */
  async exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string) {
    // 1. Verify Client
    const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
    if (!client || client.clientSecret !== clientSecret) {
      throw new Error('invalid_client');
    }

    // 2. Verify Code
    const authCode = await prisma.oAuthAuthCode.findUnique({ where: { code } });
    if (!authCode || authCode.used || authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      throw new Error('invalid_grant');
    }

    if (new Date() > authCode.expiresAt) {
      throw new Error('expired_grant');
    }

    // 3. Mark Code as Used
    await prisma.oAuthAuthCode.update({
      where: { id: authCode.id },
      data: { used: true }
    });

    // 4. Generate Tokens
    const accessToken = crypto.randomBytes(48).toString('base64url');
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ACCESS_TOKEN_EXPIRY_HOURS);

    await prisma.oAuthToken.create({
      data: {
        accessToken,
        refreshToken,
        clientId,
        userId: authCode.userId,
        expiresAt,
      }
    });

    // 5. Also sign a JWT as the ID Token (OIDC-like)
    const idToken = jwt.sign({
      sub: authCode.userId,
      aud: clientId,
      iss: 'https://pabandi.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000)
    }, JWT_SECRET);

    logger.info(`[OAuth] Code exchanged for tokens. Client: ${clientId}, User: ${authCode.userId}`);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
      refresh_token: refreshToken,
      id_token: idToken
    };
  }

  /**
   * Fetch the UserInfo payload based on a valid access token.
   * Returns Trust Passport data.
   */
  async getUserInfo(accessToken: string) {
    const token = await prisma.oAuthToken.findUnique({
      where: { accessToken },
      include: {
        user: {
          include: {
            socialIdentities: true
          }
        }
      }
    });

    if (!token || token.revoked || new Date() > token.expiresAt) {
      throw new Error('Invalid or expired access token');
    }

    const user = token.user;
    
    // Fetch Trust Passport
    const passport = await prisma.trustPassport.findFirst({
      where: { providerRef: user.id }
    });

    let trustBand = 'E';
    let trustScore = user.trustScore;

    // Resolve Band from LinkedIn profile if available
    const prof = await prisma.linkedInProfile.findFirst({
      where: { walletAddress: user.walletAddress || undefined }
    });
    if (prof?.trustBand) trustBand = prof.trustBand;
    else if (trustScore >= 90) trustBand = 'A';
    else if (trustScore >= 70) trustBand = 'B';
    else if (trustScore >= 50) trustBand = 'C';
    else if (trustScore >= 30) trustBand = 'D';

    return {
      sub: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      email_verified: user.isEmailVerified,
      trust_passport: {
        trust_score: trustScore,
        trust_band: trustBand,
        handle: passport?.handle || null,
        badges: [] as string[],
        verifications: [] as Array<{ type: string; verifiedAt: Date | null }>
      }
    };
  }
}

export const oauthService = new OAuthService();
