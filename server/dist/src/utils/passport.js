"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = configurePassport;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_github2_1 = require("passport-github2");
const passport_paypal_openidconnect_1 = require("passport-paypal-openidconnect");
const passport_facebook_1 = require("passport-facebook");
const passport_twitter_1 = require("passport-twitter");
const passport_linkedin_oauth2_1 = require("passport-linkedin-oauth2");
// @ts-ignore
const passport_tiktok_auth_1 = require("passport-tiktok-auth");
const database_1 = require("./database");
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || '';
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || '';
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '';
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || '';
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
function configurePassport() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        logger_1.logger.warn('Google OAuth credentials not set. Google login will be unavailable.');
    }
    else {
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/google/callback',
            passReqToCallback: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email)
                    return done(new Error('No email from Google profile'));
                const profilePictureUrl = profile.photos?.[0]?.value;
                const role = req.query?.state === 'business' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER;
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
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
                    logger_1.logger.info(`New Google OAuth user created: ${email} (${role})`);
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: {
                            googleId: profile.id,
                            isEmailVerified: true,
                            profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
        passport_1.default.use(new passport_github2_1.Strategy({
            clientID: GITHUB_CLIENT_ID,
            clientSecret: GITHUB_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/github/callback',
            scope: ['user:email'],
        }, async (accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email)
                    return done(new Error('No email from GitHub profile'));
                const profilePictureUrl = profile.photos?.[0]?.value;
                const role = 'CUSTOMER';
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
                        data: {
                            email,
                            passwordHash: '',
                            firstName: profile.displayName?.split(' ')[0] || profile.username || 'GitHub',
                            lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
                            role,
                            githubId: profile.id,
                            profilePictureUrl,
                            isEmailVerified: true,
                        },
                    });
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: { githubId: profile.id, isEmailVerified: true, profilePictureUrl: user.profilePictureUrl || profilePictureUrl },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    else {
        logger_1.logger.warn('GitHub OAuth credentials not set. GitHub login will use demo fallback.');
    }
    if (PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET) {
        passport_1.default.use(new passport_paypal_openidconnect_1.Strategy({
            clientID: PAYPAL_CLIENT_ID,
            clientSecret: PAYPAL_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/paypal/callback',
            scope: 'openid profile email',
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile?._json?.email || profile?.email || (profile?.emails && profile.emails[0]?.value) || '';
                if (!email)
                    return done(new Error('No email from PayPal profile'));
                const name = profile?.displayName || `${profile?._json?.given_name || ''} ${profile?._json?.family_name || ''}`.trim();
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
                        data: {
                            email,
                            passwordHash: '',
                            firstName: profile?._json?.given_name || name.split(' ')[0] || '',
                            lastName: profile?._json?.family_name || name.split(' ').slice(1).join(' ') || '',
                            role: 'CUSTOMER',
                            paypalId: profile.id,
                            isEmailVerified: true,
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    else {
        logger_1.logger.warn('PayPal OAuth credentials not set. PayPal login will use demo fallback.');
    }
    if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
        passport_1.default.use(new passport_facebook_1.Strategy({
            clientID: FACEBOOK_APP_ID,
            clientSecret: FACEBOOK_APP_SECRET,
            callbackURL: '/api/v1/auth/facebook/callback',
            profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
            passReqToCallback: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email)
                    return done(new Error('No email from Facebook profile'));
                const profilePictureUrl = profile.photos?.[0]?.value;
                const role = req.query?.state === 'business' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER;
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
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
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: {
                            facebookId: profile.id,
                            isEmailVerified: true,
                            profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    else {
        logger_1.logger.warn('Facebook OAuth credentials not set. Facebook login will be unavailable.');
    }
    if (TWITTER_CONSUMER_KEY && TWITTER_CONSUMER_SECRET) {
        passport_1.default.use(new passport_twitter_1.Strategy({
            consumerKey: TWITTER_CONSUMER_KEY,
            consumerSecret: TWITTER_CONSUMER_SECRET,
            callbackURL: '/api/v1/auth/twitter/callback',
            passReqToCallback: true,
            includeEmail: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.username}@pabandi.local`;
                const profilePictureUrl = profile.photos?.[0]?.value;
                const role = req.query?.state === 'business' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER;
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
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
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: {
                            twitterId: profile.id,
                            profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    if (LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) {
        passport_1.default.use(new passport_linkedin_oauth2_1.Strategy({
            clientID: LINKEDIN_CLIENT_ID,
            clientSecret: LINKEDIN_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/linkedin/callback',
            scope: ['r_emailaddress', 'r_liteprofile'],
            passReqToCallback: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                if (!email)
                    return done(new Error('No email from LinkedIn profile'));
                const profilePictureUrl = profile.photos?.[0]?.value;
                const role = req.query?.state === 'business' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER;
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
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
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: {
                            linkedinId: profile.id,
                            profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    if (TIKTOK_CLIENT_KEY && TIKTOK_CLIENT_SECRET) {
        passport_1.default.use(new passport_tiktok_auth_1.Strategy({
            clientID: TIKTOK_CLIENT_KEY,
            clientSecret: TIKTOK_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/tiktok/callback',
            scope: ['user.info.basic'],
            passReqToCallback: true,
        }, async (req, _accessToken, _refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value || `${profile.id}@pabandi.local`;
                const profilePictureUrl = profile.avatar_url;
                const role = req.query?.state === 'business' ? client_1.UserRole.BUSINESS_OWNER : client_1.UserRole.CUSTOMER;
                let user = await database_1.prisma.user.findUnique({ where: { email } });
                if (!user) {
                    user = await database_1.prisma.user.create({
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
                }
                else {
                    user = await database_1.prisma.user.update({
                        where: { email },
                        data: {
                            tiktokId: profile.id,
                            profilePictureUrl: user.profilePictureUrl || profilePictureUrl
                        },
                    });
                }
                return done(null, user);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
    // ─── Connection Strategies (Profile binding without logging in) ────────
    if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
        passport_1.default.use('facebook-connect', new passport_facebook_1.Strategy({
            clientID: FACEBOOK_APP_ID,
            clientSecret: FACEBOOK_APP_SECRET,
            callbackURL: '/api/v1/social/connect/facebook/callback',
            profileFields: ['id', 'emails', 'name', 'picture.type(large)']
        }, (_accessToken, _refreshToken, profile, done) => {
            return done(null, profile);
        }));
    }
    if (LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET) {
        passport_1.default.use('linkedin-connect', new passport_linkedin_oauth2_1.Strategy({
            clientID: LINKEDIN_CLIENT_ID,
            clientSecret: LINKEDIN_CLIENT_SECRET,
            callbackURL: '/api/v1/social/connect/linkedin/callback',
            scope: ['r_emailaddress', 'r_liteprofile']
        }, (_accessToken, _refreshToken, profile, done) => {
            return done(null, profile);
        }));
    }
    passport_1.default.serializeUser((user, done) => done(null, user.id || user));
    passport_1.default.deserializeUser(async (obj, done) => {
        if (typeof obj === 'string') {
            try {
                const user = await database_1.prisma.user.findUnique({ where: { id: obj } });
                done(null, user);
            }
            catch (err) {
                done(err);
            }
        }
        else {
            done(null, obj);
        }
    });
}
//# sourceMappingURL=passport.js.map