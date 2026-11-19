/**
 * 邮件发送（服务端专用）：用 nodemailer + SMTP 发验证码邮件。
 *
 * 环境变量（见 .env.example）：
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 *
 * 支持 QQ 邮箱、163、Gmail 等任意 SMTP 服务。
 * 未配置时抛错，调用方返回友好提示。
 */
import nodemailer from "nodemailer";

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    user,
    pass,
    from: process.env.SMTP_FROM?.trim() || user,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}

export async function sendVerificationCode(
  to: string,
  code: string,
): Promise<void> {
  const config = getSmtpConfig();
  if (!config) throw new Error("SMTP_NOT_CONFIGURED");

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // 465 用 SSL，587 用 STARTTLS
    auth: { user: config.user, pass: config.pass },
  });

  await transporter.sendMail({
    from: `OutfitHub <${config.from}>`,
    to,
    subject: "OutfitHub 登录验证码",
    text: `你的登录验证码是 ${code}，5 分钟内有效。如果不是本人操作，请忽略此邮件。`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 14px; color: #666;">OutfitHub · 你的私人穿搭衣橱</p>
        <h1 style="font-size: 28px; letter-spacing: 4px; margin: 12px 0;">${code}</h1>
        <p style="font-size: 14px; color: #333;">这是你的登录验证码，5 分钟内有效。</p>
        <p style="font-size: 12px; color: #999;">如果不是本人操作，请忽略此邮件。</p>
      </div>
    `,
  });
}
