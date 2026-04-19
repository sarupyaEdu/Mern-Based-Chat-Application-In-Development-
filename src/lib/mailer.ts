import "server-only";

import nodemailer from "nodemailer";

const brevoApiKey = process.env.BREVO_API_KEY;
const smtpHost = process.env.EMAIL_SERVER_HOST;
const smtpPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const smtpUser = process.env.EMAIL_SERVER_USER;
const smtpPass = process.env.EMAIL_SERVER_PASSWORD;
const smtpFrom = process.env.EMAIL_FROM;

export function isEmailConfigured() {
  return Boolean(
    smtpFrom && (brevoApiKey || (smtpHost && smtpPort && smtpUser && smtpPass)),
  );
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

async function sendWithBrevoApi({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (!brevoApiKey || !smtpFrom) {
    throw new Error("Brevo email API is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: {
          email: smtpFrom,
        },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Brevo API request failed: ${res.status} ${errorBody}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  if (brevoApiKey) {
    await sendWithBrevoApi({ to, subject, text, html });
    return;
  }

  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("Email transport is not configured");
  }

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetOtpEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  await sendMail({
    to,
    subject: "Your password reset OTP",
    text: `Your OTP for resetting the password is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Password Reset OTP</h2>
        <p>Your OTP for resetting the password is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
}

export async function sendEmailVerificationOtpEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  await sendMail({
    to,
    subject: "Verify your email",
    text: `Your OTP for verifying your email is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Email Verification OTP</h2>
        <p>Your OTP for verifying your email is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
}

export async function sendLoginTwoFactorOtpEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  await sendMail({
    to,
    subject: "Your 2FA login code",
    text: `Your OTP for finishing sign in is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Two-Factor Login OTP</h2>
        <p>Use this OTP to finish signing in:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
}

export async function sendDisableTwoFactorOtpEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  await sendMail({
    to,
    subject: "Disable 2FA OTP",
    text: `Your OTP for disabling two-factor authentication is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Disable Two-Factor Authentication</h2>
        <p>Use this OTP to disable two-factor authentication:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${otp}</p>
        <p>This OTP expires in 10 minutes.</p>
      </div>
    `,
  });
}
