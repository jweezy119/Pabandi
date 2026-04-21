import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './database';
import { UserRole } from '@prisma/client';
import { logger } from './logger';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

export function configurePassport() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth credentials not set. Google login will be unavailable.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${BACKEND_URL}/api/v1/auth/google/callback`,
        passReqToCallback: true,
      },
      async (req: any, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('No email from Google profile'));

          // Determine role from query param set during redirect
          const role: UserRole = req.query?.state === 'business'
            ? UserRole.BUSINESS_OWNER
            : UserRole.CUSTOMER;

          let user: any = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            // Create new user from Google profile
            user = await (prisma.user as any).create({
              data: {
                email,
                passwordHash: '', // no password for OAuth users
                firstName: profile.name?.givenName || profile.displayName || 'User',
                lastName: profile.name?.familyName || '',
                role,
                googleId: profile.id,
                isEmailVerified: true,
              },
            });
            logger.info(`New Google OAuth user created: ${email} (${role})`);
          } else if (!user.googleId) {
            // Link Google account to existing email user
            user = await (prisma.user as any).update({
              where: { email },
              data: { googleId: profile.id, isEmailVerified: true },
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
