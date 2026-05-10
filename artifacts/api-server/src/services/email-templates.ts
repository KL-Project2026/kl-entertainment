/**
 * KL Group email templates — Quiet Luxury Edition (Design Guidelines v3.0).
 * Black canvas + gold accent + serif logo. No gradients, no shadows.
 * Inline styles only (Gmail strips <style>). 600px max width, table layout.
 *
 * Multi-locale: en, ko, zh, ms, ja, th. Falls back to en when locale missing.
 */

export type EmailLocale = "en" | "ko" | "zh" | "ms" | "ja" | "th";

const SUPPORTED: EmailLocale[] = ["en", "ko", "zh", "ms", "ja", "th"];

export function normalizeLocale(input: string | null | undefined): EmailLocale {
  if (!input) return "en";
  const code = input.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED as string[]).includes(code) ? (code as EmailLocale) : "en";
}

const COLORS = {
  bg: "#0A0A0D",
  card: "#18181C",
  borderSubtle: "rgba(255,255,255,0.06)",
  divider: "rgba(201,169,97,0.35)",
  textPrimary: "#FAFAFA",
  textSecondary: "#B4B4B8",
  textTertiary: "#7E7E84",
  gold: "#C9A961",
  goldFg: "#0A0A0D",
};

// ─── Strings (per locale) ──────────────────────────────────────────────
type ResetStrings = {
  subject: string;
  preheader: (m: number) => string;
  heading: string;
  subheading: string;
  greet: (name: string) => string;
  intro: string;
  cta: string;
  validityLabel: string;
  validity: (m: number) => string;
  notRequestedLabel: string;
  notRequested: string;
  fallback: string;
  footerNote: string;
  footerSupport: (email: string) => string;
  brandTag: string;
  portalTag: string;
};

const RESET: Record<EmailLocale, ResetStrings> = {
  en: {
    subject: "[KL Group] Password reset request",
    preheader: (m) => `Reset your password within ${m} minutes.`,
    heading: "Password Reset",
    subheading: "Account Security",
    greet: (name) => `Hello, <span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span>.`,
    intro: "We received a request to reset the password for your KL Group Management Portal account.<br/>Click the button below to set a new password.",
    cta: "Reset Password",
    validityLabel: "Valid for",
    validity: (m) => `This link will expire ${m} minutes after this email was sent.`,
    notRequestedLabel: "Didn't request this?",
    notRequested: "You can safely ignore this email. Your password will not change.",
    fallback: "If the button doesn't work, copy and paste the link below into your browser.",
    footerNote: "This is an automated message from KL Group Management Portal.",
    footerSupport: (email) => `For assistance, please contact <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a>.`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
  ko: {
    subject: "[KL Group] 비밀번호 재설정 안내",
    preheader: (m) => `${m}분 안에 아래 버튼으로 비밀번호를 재설정해 주세요.`,
    heading: "비밀번호 재설정",
    subheading: "계정 보안 안내",
    greet: (name) => `안녕하세요, <span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span> 님.`,
    intro: "KL Group Management Portal 계정의 비밀번호 재설정 요청이 접수되었습니다.<br/>아래 버튼을 눌러 새로운 비밀번호를 설정해 주세요.",
    cta: "비밀번호 재설정하기",
    validityLabel: "유효 시간",
    validity: (m) => `이 링크는 발송 후 ${m}분 동안만 사용 가능합니다.`,
    notRequestedLabel: "요청한 적이 없으신가요?",
    notRequested: "본 메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.",
    fallback: "버튼이 동작하지 않으면 아래 링크를 복사해 브라우저 주소창에 붙여넣어 주세요.",
    footerNote: "본 메일은 KL Group Management Portal 시스템에서 발송된 자동 메일입니다.",
    footerSupport: (email) => `문의: <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a>`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
  zh: {
    subject: "[KL Group] 密码重置请求",
    preheader: (m) => `请在 ${m} 分钟内重置您的密码。`,
    heading: "密码重置",
    subheading: "账户安全提醒",
    greet: (name) => `您好，<span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span>。`,
    intro: "我们收到了重置您 KL Group Management Portal 账户密码的请求。<br/>点击下方按钮以设置新密码。",
    cta: "重置密码",
    validityLabel: "有效时间",
    validity: (m) => `此链接将在邮件发送后 ${m} 分钟内有效。`,
    notRequestedLabel: "并非您本人请求？",
    notRequested: "请忽略此邮件，您的密码不会发生变更。",
    fallback: "如按钮无法点击，请复制以下链接并粘贴到浏览器地址栏。",
    footerNote: "此邮件由 KL Group Management Portal 系统自动发送。",
    footerSupport: (email) => `如需帮助，请联系 <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a>。`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
  ms: {
    subject: "[KL Group] Permintaan tetap semula kata laluan",
    preheader: (m) => `Tetap semula kata laluan anda dalam ${m} minit.`,
    heading: "Tetapan Semula Kata Laluan",
    subheading: "Keselamatan Akaun",
    greet: (name) => `Salam, <span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span>.`,
    intro: "Kami menerima permintaan untuk menetapkan semula kata laluan akaun KL Group Management Portal anda.<br/>Klik butang di bawah untuk menetapkan kata laluan baharu.",
    cta: "Tetap Semula Kata Laluan",
    validityLabel: "Sah selama",
    validity: (m) => `Pautan ini akan tamat tempoh ${m} minit selepas e-mel ini dihantar.`,
    notRequestedLabel: "Bukan anda yang meminta?",
    notRequested: "Sila abaikan e-mel ini. Kata laluan anda tidak akan berubah.",
    fallback: "Jika butang tidak berfungsi, sila salin dan tampal pautan di bawah ke pelayar anda.",
    footerNote: "Ini adalah mesej automatik daripada KL Group Management Portal.",
    footerSupport: (email) => `Untuk bantuan, sila hubungi <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a>.`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
  ja: {
    subject: "[KL Group] パスワード再設定のご案内",
    preheader: (m) => `${m}分以内にパスワードを再設定してください。`,
    heading: "パスワードを再設定",
    subheading: "アカウントセキュリティ",
    greet: (name) => `<span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span> 様`,
    intro: "KL Group Management Portal アカウントのパスワード再設定リクエストを受け付けました。<br/>下のボタンから新しいパスワードを設定してください。",
    cta: "パスワードを再設定",
    validityLabel: "有効期限",
    validity: (m) => `このリンクはメール送信から${m}分間のみ有効です。`,
    notRequestedLabel: "お心当たりがない場合",
    notRequested: "本メールは破棄してください。パスワードは変更されません。",
    fallback: "ボタンが動作しない場合は、下記のリンクをコピーしてブラウザに貼り付けてください。",
    footerNote: "本メールは KL Group Management Portal から自動送信されています。",
    footerSupport: (email) => `お問い合わせは <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a> までお願いいたします。`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
  th: {
    subject: "[KL Group] คำขอรีเซ็ตรหัสผ่าน",
    preheader: (m) => `รีเซ็ตรหัสผ่านของคุณภายใน ${m} นาที`,
    heading: "รีเซ็ตรหัสผ่าน",
    subheading: "ความปลอดภัยของบัญชี",
    greet: (name) => `เรียนคุณ <span style="color:${COLORS.textPrimary};font-weight:500;">${name}</span>`,
    intro: "เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี KL Group Management Portal ของคุณ<br/>กรุณาคลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่",
    cta: "รีเซ็ตรหัสผ่าน",
    validityLabel: "ระยะเวลาที่ใช้ได้",
    validity: (m) => `ลิงก์นี้จะหมดอายุใน ${m} นาทีหลังจากส่งอีเมลฉบับนี้`,
    notRequestedLabel: "ไม่ได้เป็นผู้ร้องขอ?",
    notRequested: "คุณสามารถเพิกเฉยต่ออีเมลฉบับนี้ได้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยน",
    fallback: "หากปุ่มใช้งานไม่ได้ กรุณาคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ของคุณ",
    footerNote: "อีเมลนี้ส่งโดยอัตโนมัติจากระบบ KL Group Management Portal",
    footerSupport: (email) => `หากต้องการความช่วยเหลือ กรุณาติดต่อ <a href="mailto:${email}" style="color:${COLORS.gold};text-decoration:none;">${email}</a>`,
    brandTag: "KL Group",
    portalTag: "Management Portal",
  },
};

const SUPPORT_EMAIL = "support@kl-project.com";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function shell(content: string, preheader: string, locale: EmailLocale, brandTag: string, portalTag: string): string {
  return `<!DOCTYPE html>
<html lang="${locale}"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark only" />
<meta name="supported-color-schemes" content="dark only" />
<title>KL Group</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.textPrimary};font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.bg};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
      <tr><td align="center" style="padding:0 0 32px 0;">
        <div style="font-family:'Playfair Display','Times New Roman',Georgia,serif;font-weight:500;font-size:44px;letter-spacing:-0.01em;line-height:1;color:${COLORS.gold};">KL</div>
        <div style="height:1px;width:36px;background:${COLORS.divider};margin:14px auto 12px auto;"></div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.32em;color:${COLORS.textPrimary};text-transform:uppercase;">${brandTag}</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;letter-spacing:0.24em;color:${COLORS.textTertiary};text-transform:uppercase;margin-top:4px;">${portalTag}</div>
      </td></tr>
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.borderSubtle};border-radius:12px;padding:40px 36px;">
        ${content}
      </td></tr>
      <tr><td align="center" style="padding:28px 8px 0 8px;">
        <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:${COLORS.textTertiary};line-height:1.6;">
          ${RESET[locale].footerNote}<br/>
          ${RESET[locale].footerSupport(SUPPORT_EMAIL)}
        </div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;letter-spacing:0.18em;color:${COLORS.textTertiary};text-transform:uppercase;margin-top:14px;">
          &copy; KL Group · Premium Karaoke Lounges
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function passwordResetEmail(params: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
  locale?: EmailLocale | string | null;
}): { subject: string; html: string; text: string } {
  const locale = normalizeLocale(typeof params.locale === "string" ? params.locale : params.locale ?? "en");
  const s = RESET[locale];
  const safeName = escapeHtml(params.name);

  const body = `
    <div style="font-family:'Playfair Display','Times New Roman',Georgia,serif;font-size:22px;font-weight:500;line-height:1.3;color:${COLORS.textPrimary};letter-spacing:-0.005em;margin:0 0 8px 0;">
      ${s.heading}
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${COLORS.textTertiary};letter-spacing:0.04em;margin:0 0 28px 0;">
      ${s.subheading}
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:${COLORS.textSecondary};margin:0 0 12px 0;">
      ${s.greet(safeName)}
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:${COLORS.textSecondary};margin:0 0 32px 0;">
      ${s.intro}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
      <tr><td align="center" style="background:${COLORS.gold};border-radius:8px;">
        <a href="${params.resetUrl}" style="display:inline-block;padding:13px 32px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;color:${COLORS.goldFg};text-decoration:none;">
          ${s.cta}
        </a>
      </td></tr>
    </table>
    <div style="height:1px;background:${COLORS.borderSubtle};margin:0 0 24px 0;"></div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.textTertiary};margin:0 0 16px 0;">
      <span style="color:${COLORS.textSecondary};font-weight:500;">${s.validityLabel}</span> &nbsp;·&nbsp; ${s.validity(params.expiresInMinutes)}
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.textTertiary};margin:0 0 16px 0;">
      <span style="color:${COLORS.textSecondary};font-weight:500;">${s.notRequestedLabel}</span> &nbsp;·&nbsp; ${s.notRequested}
    </div>
    <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:11px;line-height:1.6;color:${COLORS.textTertiary};word-break:break-all;background:${COLORS.bg};border:1px solid ${COLORS.borderSubtle};border-radius:6px;padding:12px 14px;margin-top:24px;">
      ${s.fallback}<br/>
      <a href="${params.resetUrl}" style="color:${COLORS.gold};text-decoration:none;">${params.resetUrl}</a>
    </div>
  `;

  const text = [
    s.subject,
    "",
    s.greet(params.name).replace(/<[^>]+>/g, ""),
    "",
    s.intro.replace(/<br\/?>/g, "\n").replace(/<[^>]+>/g, ""),
    "",
    params.resetUrl,
    "",
    s.validity(params.expiresInMinutes),
    s.notRequested,
    "",
    "— KL Group · Management Portal",
  ].join("\n");

  return {
    subject: s.subject,
    html: shell(body, s.preheader(params.expiresInMinutes), locale, s.brandTag, s.portalTag),
    text,
  };
}
