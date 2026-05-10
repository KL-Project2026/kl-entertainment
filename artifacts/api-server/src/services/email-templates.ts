/**
 * KL Group email templates — Quiet Luxury Edition (Design Guidelines v3.0).
 * Black canvas + gold accent + serif logo. No gradients, no shadows.
 * Inline styles only (Gmail strips <style>). 600px max width, table layout.
 */

const COLORS = {
  bg: "#0A0A0D",
  card: "#18181C",
  borderSubtle: "rgba(255,255,255,0.06)",
  borderDefault: "rgba(255,255,255,0.10)",
  divider: "rgba(201,169,97,0.35)",
  textPrimary: "#FAFAFA",
  textSecondary: "#B4B4B8",
  textTertiary: "#7E7E84",
  gold: "#C9A961",
  goldFg: "#0A0A0D",
};

function shell(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="ko"><head>
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
      <!-- Header — KL serif mark -->
      <tr><td align="center" style="padding:0 0 32px 0;">
        <div style="font-family:'Playfair Display','Times New Roman',Georgia,serif;font-weight:500;font-size:44px;letter-spacing:-0.01em;line-height:1;color:${COLORS.gold};">KL</div>
        <div style="height:1px;width:36px;background:${COLORS.divider};margin:14px auto 12px auto;"></div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.32em;color:${COLORS.textPrimary};text-transform:uppercase;">KL Group</div>
        <div style="font-family:'Inter',Arial,sans-serif;font-size:10px;letter-spacing:0.24em;color:${COLORS.textTertiary};text-transform:uppercase;margin-top:4px;">Management Portal</div>
      </td></tr>
      <!-- Card -->
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.borderSubtle};border-radius:12px;padding:40px 36px;">
        ${content}
      </td></tr>
      <!-- Footer -->
      <tr><td align="center" style="padding:28px 8px 0 8px;">
        <div style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:${COLORS.textTertiary};line-height:1.6;">
          본 메일은 KL Group Management Portal 시스템에서 발송된 자동 메일입니다.<br/>
          회신이 필요한 경우 <a href="mailto:support@klproject.com" style="color:${COLORS.gold};text-decoration:none;">support@klproject.com</a> 으로 문의 바랍니다.
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
}): { subject: string; html: string; text: string } {
  const { name, resetUrl, expiresInMinutes } = params;
  const subject = "[KL Group] 비밀번호 재설정 안내";
  const preheader = `${expiresInMinutes}분 안에 아래 버튼으로 비밀번호를 재설정해 주세요.`;

  const body = `
    <div style="font-family:'Playfair Display','Times New Roman',Georgia,serif;font-size:22px;font-weight:500;line-height:1.3;color:${COLORS.textPrimary};letter-spacing:-0.005em;margin:0 0 8px 0;">
      비밀번호 재설정
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:${COLORS.textTertiary};letter-spacing:0.04em;margin:0 0 28px 0;">
      Password Reset Request
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:${COLORS.textSecondary};margin:0 0 12px 0;">
      안녕하세요, <span style="color:${COLORS.textPrimary};font-weight:500;">${escapeHtml(name)}</span> 님.
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:14px;line-height:1.7;color:${COLORS.textSecondary};margin:0 0 32px 0;">
      KL Group Management Portal 계정의 비밀번호 재설정 요청이 접수되었습니다.<br/>
      아래 버튼을 눌러 새로운 비밀번호를 설정해 주세요.
    </div>
    <!-- CTA — gold accent, used once -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px 0;">
      <tr><td align="center" style="background:${COLORS.gold};border-radius:8px;">
        <a href="${resetUrl}" style="display:inline-block;padding:13px 32px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.04em;color:${COLORS.goldFg};text-decoration:none;">
          비밀번호 재설정하기
        </a>
      </td></tr>
    </table>
    <div style="height:1px;background:${COLORS.borderSubtle};margin:0 0 24px 0;"></div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.textTertiary};margin:0 0 16px 0;">
      <span style="color:${COLORS.textSecondary};font-weight:500;">유효 시간</span> &nbsp;·&nbsp; 이 링크는 발송 후 ${expiresInMinutes}분 동안만 사용 가능합니다.
    </div>
    <div style="font-family:'Inter',Arial,sans-serif;font-size:12px;line-height:1.7;color:${COLORS.textTertiary};margin:0 0 16px 0;">
      <span style="color:${COLORS.textSecondary};font-weight:500;">요청한 적이 없으신가요?</span> &nbsp;·&nbsp; 본 메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.
    </div>
    <div style="font-family:'JetBrains Mono','Menlo',monospace;font-size:11px;line-height:1.6;color:${COLORS.textTertiary};word-break:break-all;background:${COLORS.bg};border:1px solid ${COLORS.borderSubtle};border-radius:6px;padding:12px 14px;margin-top:24px;">
      버튼이 동작하지 않으면 아래 링크를 복사해 브라우저 주소창에 붙여넣어 주세요.<br/>
      <a href="${resetUrl}" style="color:${COLORS.gold};text-decoration:none;">${resetUrl}</a>
    </div>
  `;

  const text = [
    "[KL Group] 비밀번호 재설정 안내",
    "",
    `안녕하세요, ${name} 님.`,
    "",
    "KL Group Management Portal 계정의 비밀번호 재설정 요청이 접수되었습니다.",
    "아래 링크를 통해 새 비밀번호를 설정해 주세요.",
    "",
    resetUrl,
    "",
    `이 링크는 발송 후 ${expiresInMinutes}분 동안 유효합니다.`,
    "본 요청을 한 적이 없다면 이 메일을 무시하셔도 됩니다.",
    "",
    "— KL Group · Management Portal",
  ].join("\n");

  return { subject, html: shell(body, preheader), text };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
