import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GithubStrategy } from 'passport-github2';
import { Strategy as PayPalStrategy } from 'passport-paypal-openidconnect';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
// @ts-ignore
import { Strategy as TikTokStrategy } from 'passport-tiktok-auth';
import { prisma } from './database';
import { UserRole } from '@prisma/client';
import { logger } from './logger';
import { findOrCreateUser } from '../services/identity.service';
import { loginCredentials } from '../config/paypal-credentials';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || '';
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || '';
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

export function configurePassport() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    logger.warn('Google OAuth credentials not set. Google login will be unavailable.');
  } else {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: '/api/v1/auth/google/callback',
          passReqToCallback: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google profile'));
            const profilePictureUrl = profile.photos?.[0]?.value;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            const user = await findOrCreateUser({
              provider: 'google',
              providerId: profile.id,
              email,
              metadata: { name: profile.displayName, avatar: profilePictureUrl, role: role === UserRole.BUSINESS_OWNER ? 'business' : 'personal' },
            });

            if (user.role !== role) {
              await prisma.user.update({
                where: { id: user.id },
                data: { role },
              });
            }
            if (!user.googleId) {
              await prisma.user.update({
                where: { id: user.id },
                data: { googleId: profile.id, isEmailVerified: true, profilePictureUrl: user.profilePictureUrl || profilePictureUrl },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

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
            const role: UserRole = 'CUSTOMER';
            const user = await findOrCreateUser({
              provider: 'github',
              providerId: profile.id,
              email,
              metadata: { login: profile.username, name: profile.displayName, avatar: profilePictureUrl },
            });

            if (!user.githubId) {
              await prisma.user.update({
                where: { id: user.id },
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
  } else {
    logger.warn('GitHub OAuth credentials not set. GitHub login will use demo fallback.');
  }

  // PayPal sign-in reads its own credentials. It used to share
  // PAYPAL_CLIENT_ID/SECRET with the payments service, so rotating the pair for
  // checkout silently broke login at the next restart.
  const paypalLogin = loginCredentials();
  if (paypalLogin) {
    passport.use(
      new PayPalStrategy(
        {
          clientID: paypalLogin.clientId,
          clientSecret: paypalLogin.clientSecret,
          callbackURL: '/api/v1/auth/paypal/callback',
          scope: 'openid profile email',
        },
        async (accessToken: string, refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile?._json?.email || profile?.email || (profile?.emails && profile.emails[0]?.value) || '';
            if (!email) return done(new Error('No email from PayPal profile'));
            const name = profile?.displayName || `${profile?._json?.given_name || ''} ${profile?._json?.family_name || ''}`.trim();
            let user: any = await (prisma.user as any).findUnique({ where: { email } });
            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile?._json?.given_name || name.split(' ')[0] || '',
                  lastName: profile?._json?.family_name || name.split(' ').slice(1).join(' ') || '',
                  role: 'CUSTOMER' as any,
                  paypalId: profile.id,
                  isEmailVerified: true,
                },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  } else {
    logger.warn('PayPal OAuth credentials not set. PayPal login will use demo fallback.');
  }

  if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: FACEBOOK_APP_ID,
          clientSecret: FACEBOOK_APP_SECRET,
          callbackURL: '/api/v1/auth/facebook/callback',
          profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
          passReqToCallback: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Facebook profile'));
            const profilePictureUrl = profile.photos?.[0]?.value;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            let user: any = await prisma.user.findUnique({ where: { email } });

            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.name?.givenName || 'User',
                  lastName: profile.name?.familyName || '',
                  role,
                  facebookId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: { 
                  facebookId: profile.id, 
                  isEmailVerified: true,
                  profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  } else {
    logger.warn('Facebook OAuth credentials not set. Facebook login will be unavailable.');
  }

  if (TWITTER_CONSUMER_KEY && TWITTER_CONSUMER_SECRET) {
    passport.use(
      new TwitterStrategy(
        {
          consumerKey: TWITTER_CONSUMER_KEY,
          consumerSecret: TWITTER_CONSUMER_SECRET,
          callbackURL: '/api/v1/auth/twitter/callback',
          passReqToCallback: true,
          includeEmail: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.username}@pabandi.local`;
            const profilePictureUrl = profile.photos?.[0]?.value;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            let user: any = await prisma.user.findUnique({ where: { email } });

            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.displayName || profile.username || 'User',
                  lastName: '',
                  role,
                  twitterId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: {
                  twitterId: profile.id,
                  profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  if (LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) {
    passport.use(
      new LinkedInStrategy(
        {
          clientID: LINKEDIN_CLIENT_ID,
          clientSecret: LINKEDIN_CLIENT_SECRET,
          callbackURL: '/api/v1/auth/linkedin/callback',
          scope: ['r_emailaddress', 'r_liteprofile'],
          passReqToCallback: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from LinkedIn profile'));
            const profilePictureUrl = profile.photos?.[0]?.value;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            let user: any = await prisma.user.findUnique({ where: { email } });

            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.name?.givenName || 'User',
                  lastName: profile.name?.familyName || '',
                  role,
                  linkedinId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: { 
                  linkedinId: profile.id,
                  profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  if (TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET) {
    passport.use(
      new TikTokStrategy(
        {
          clientID: TIKTOK_CLIENT_KEY,
          clientSecret: TIKTOK_CLIENT_SECRET,
          callbackURL: '/api/v1/auth/tiktok/callback',
          scope: ['user.info.basic'],
          passReqToCallback: true,
        },
        async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
          const email = profile.emails?.[0]?.value || `${profile.id}@pabandi.local`;
            const profilePictureUrl = profile.avatar_url;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            let user: any = await prisma.user.findUnique({ where: { email } });

            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.displayName || 'User',
                  lastName: '',
                  role,
                  tiktokId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: {
                  tiktokId: profile.id,
                  profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                },
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err);
          }
        }
      ) as any
    );
  }

  // ─── Connection Strategies (Profile binding without logging in) ────────
  if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
    passport.use('facebook-connect', new FacebookStrategy({
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: '/api/v1/social/connect/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture.type(large)']
    }, (_accessToken, _refreshToken, profile, done) => {
      return done(null, profile);
    }));
  }

  if (LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) {
    passport.use('linkedin-connect', new LinkedInStrategy({
      clientID: LINKEDIN_CLIENT_ID,
      clientSecret: LINKEDIN_CLIENT_SECRET,
      callbackURL: '/api/v1/social/connect/linkedin/callback',
      scope: ['r_emailaddress', 'r_liteprofile']
    }, (_accessToken, _refreshToken, profile, done) => {
      return done(null, profile);
    }));
  }

  passport.serializeUser((user: any, done) => done(null, user.id || user));
  passport.deserializeUser(async (obj: any, done) => {
    if (typeof obj === 'string') {
      try {
        const user = await prisma.user.findUnique({ where: { id: obj } });
        done(null, user);
      } catch (err) {
        done(err);
      }
    } else {
      done(null, obj);
    }
  });
}
