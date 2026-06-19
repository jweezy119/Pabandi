import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
// @ts-ignore
import { Strategy as TikTokStrategy } from 'passport-tiktok-auth';
import { prisma } from './database';
import { UserRole } from '@prisma/client';
import { logger } from './logger';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
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
          callbackURL: `${BACKEND_URL}/api/v1/auth/google/callback`,
          passReqToCallback: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google profile'));
            const profilePictureUrl = profile.photos?.[0]?.value;

            const role: UserRole = req.query?.state === 'business' ? UserRole.BUSINESS_OWNER : UserRole.CUSTOMER;
            let user: any = await prisma.user.findUnique({ where: { email } });

            if (!user) {
              user = await (prisma.user as any).create({
                data: {
                  email,
                  passwordHash: '',
                  firstName: profile.name?.givenName || profile.displayName || 'User',
                  lastName: profile.name?.familyName || '',
                  role,
                  googleId: profile.id,
                  profilePictureUrl,
                  isEmailVerified: true,
                },
              });
              logger.info(`New Google OAuth user created: ${email} (${role})`);
            } else {
              user = await (prisma.user as any).update({
                where: { email },
                data: { 
                  googleId: profile.id, 
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
  }

  if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: FACEBOOK_APP_ID,
          clientSecret: FACEBOOK_APP_SECRET,
          callbackURL: `${BACKEND_URL}/api/v1/auth/facebook/callback`,
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
          callbackURL: `${BACKEND_URL}/api/v1/auth/twitter/callback`,
          passReqToCallback: true,
          includeEmail: true,
        },
        async (req: any, _accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.username}@twitter.oauth.placeholder`;
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
          callbackURL: `${BACKEND_URL}/api/v1/auth/linkedin/callback`,
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
          callbackURL: `${BACKEND_URL}/api/v1/auth/tiktok/callback`,
          scope: ['user.info.basic'],
          passReqToCallback: true,
        },
        async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value || `${profile.id}@tiktok.oauth.placeholder`;
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
