import "server-only";

import nodemailer from "nodemailer";

const smtpHost = process.env.EMAIL_SERVER_HOST;
const smtpPort = Number(process.env.EMAIL_SERVER_PORT || 587);
const smtpUser = process.env.EMAIL_SERVER_USER;
const smtpPass = process.env.EMAIL_SERVER_PASSWORD;
const smtpFrom = process.env.EMAIL_FROM;

export function isEmailConfigured() {
  return Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom);
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

export async function sendPasswordResetOtpEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("Email transport is not configured");
  }

  await transporter.sendMail({
    from: smtpFrom,
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
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("Email transport is not configured");
  }

  await transporter.sendMail({
    from: smtpFrom,
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
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("Email transport is not configured");
  }

  await transporter.sendMail({
    from: smtpFrom,
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
  const transporter = getTransporter();

  if (!transporter) {
    throw new Error("Email transport is not configured");
  }

  await transporter.sendMail({
    from: smtpFrom,
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
