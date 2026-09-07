import { Router, Request, Response } from 'express';

const router = Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
const CLIENT_URL = process.env.CLIENT_URL || 'https://pabandi.com';

// GitHub OAuth login — redirect to GitHub
router.get('/github', (req: Request, res: Response) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
  }
  const redirectUri = `${API_URL}/api/v1/auth/social/github/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.redirect(githubUrl);
});

// GitHub OAuth callback — lightweight, no DB/JWT
router.get('/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${CLIENT_URL}/login?error=github_no_code`);
    }

    // Lazy-load heavy deps only when needed
    const axios = (await import('axios')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('../utils/database');

    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.redirect(`${CLIENT_URL}/login?error=github_token`);
    }

    // Get user info
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });

    const githubUser = userRes.data;
    let email = githubUser.email;

    // If email not public, get from emails endpoint
    if (!email) {
      const emailsRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `token ${accessToken}` },
      });
      const primaryEmail = emailsRes.data.find((e: any) => e.primary && e.verified);
      email = primaryEmail?.email;
    }

    if (!email) {
      return res.redirect(`${CLIENT_URL}/login?error=github_no_email`);
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: '',
          firstName: githubUser.name?.split(' ')[0] || githubUser.login || 'GitHub',
          lastName: githubUser.name?.split(' ').slice(1).join(' ') || '',
          role: 'CUSTOMER',
          githubId: String(githubUser.id),
          profilePictureUrl: githubUser.avatar_url,
          isEmailVerified: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { email },
        data: { githubId: String(githubUser.id), isEmailVerified: true, profilePictureUrl: user.profilePictureUrl || githubUser.avatar_url },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '7d' }
    );

    res.redirect(`${CLIENT_URL}/auth/callback?token=${token}`);
  } catch (error: any) {
    res.redirect(`${CLIENT_URL}/login?error=github`);
  }
});

export default router;
