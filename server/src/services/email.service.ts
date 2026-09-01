import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || 'verify@pabandi.com';

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? parseInt(SMTP_PORT) : 587,
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendVerificationEmail(to: string, code: string, firstName: string): Promise<boolean> {
  const subject = 'Verify your Pabandi account';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; font-size: 28px; margin: 0;">🛡️ Pabandi</h1>
      </div>
      <div style="background: #f9fafb; border-radius: 12px; padding: 30px; text-align: center;">
        <h2 style="color: #1f2937; margin: 0 0 10px;">Welcome, ${firstName}!</h2>
        <p style="color: #6b7280; margin: 0 0 25px;">Use this code to verify your email address:</p>
        <div style="background: white; border: 2px dashed #6366f1; border-radius: 8px; padding: 15px; margin: 0 0 25px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #6366f1;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px; margin: 0;">This code expires in 15 minutes.</p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
        If you didn't create a Pabandi account, you can safely ignore this email.
      </p>
    </div>
  `;

  if (!transporter) {
    logger.warn(`[email] SMTP not configured — verification code for ${to}: ${code}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Pabandi" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    logger.info(`[email] Verification code sent to ${to}`);
    return true;
  } catch (error: any) {
    logger.error(`[email] Failed to send verification email: ${error.message}`);
    return false;
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
