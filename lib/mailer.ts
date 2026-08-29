import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;
let transporterSignature = '';

function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim();
  // Google displays App Passwords with spaces (xxxx xxxx xxxx xxxx).
  // SMTP authentication expects the 16 characters without those spaces.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS are required. SMTP_USER must be the sender Gmail address and SMTP_PASS must be its Google App Password.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number.');
  }

  return { user, pass, host, port, secure };
}

function getTransporter() {
  const config = getSmtpConfig();
  // Recreate the transporter if credentials/config changed during local development.
  const signature = `${config.user}|${config.pass}|${config.host}|${config.port}|${config.secure}`;
  if (transporter && transporterSignature === signature) return transporter;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
  transporterSignature = signature;
  return transporter;
}

export async function sendOtpEmail(to: string, otp: string, purpose: 'signup' | 'password') {
  const smtp = getSmtpConfig();
  const from = process.env.SMTP_FROM?.trim() || smtp.user;
  const subject = purpose === 'signup' ? 'Verify your Roadmap account' : 'Your Roadmap password OTP';
  const text = purpose === 'signup'
    ? `Your Roadmap verification code is ${otp}. It expires in 10 minutes. If you did not create this account, ignore this email.`
    : `Your Roadmap password-change code is ${otp}. It expires in 10 minutes. If you did not request a password change, ignore this email.`;

  try {
    await getTransporter().sendMail({
      from,
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${subject}</h2><p>Your verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in <b>10 minutes</b>.</p><p>If you did not request this, you can safely ignore this email.</p></div>`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to send OTP email through ${smtp.host}:${smtp.port} as ${smtp.user}. ${message}`);
  }
}
