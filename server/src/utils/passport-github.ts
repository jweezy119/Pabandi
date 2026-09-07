import passport from 'passport';
import { Strategy as GithubStrategy } from 'passport-github2';
import { prisma } from './database';
import { logger } from './logger';

export function configurePassport() {
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    passport.use(
      new GithubStrategy(
        {
          clientID: GITHUB_CLIENT_ID,
          clientSecret: GITHUB_CLIENT_SECRET,
          callbackURL: '/api/v1/auth/social/github/callback',
          scope: ['user:email'],
        },
        async (accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from GitHub profile'));
            const profilePictureUrl = profile.photos?.[0]?.value;
            let user: any = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.displayName?.split(' ')[0] || profile.username || 'GitHub',
                  lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
                  role: 'CUSTOMER',
                  githubId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: { githubId: profile.id, isEmailVerified: true, profilePictureUrl: user.profilePictureUrl || profilePictureUrl },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
    logger.info('GitHub OAuth strategy registered');
  } else {
    logger.warn('GitHub OAuth credentials not set');
  }
}
