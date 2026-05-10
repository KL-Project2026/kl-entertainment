/**
 * Send Quiet-Luxury password-reset SAMPLE emails (one per locale)
 * to klproject.com@gmail.com to validate Resend + design + translations.
 *
 * Run from api-server: tsx scripts/send-sample-email.ts
 */
import { sendEmail } from "../src/services/email";
import { passwordResetEmail, type EmailLocale } from "../src/services/email-templates";

const TO = "klproject.com@gmail.com";
const RESET_URL = "https://app.kl-project.com/reset-password?token=SAMPLE_TOKEN_FOR_DESIGN_PREVIEW";
const LOCALES: { code: EmailLocale; name: string }[] = [
  { code: "en", name: "KL Group Admin" },
  { code: "ko", name: "KL 그룹 관리자" },
  { code: "zh", name: "KL Group 管理员" },
  { code: "ms", name: "KL Group Admin" },
  { code: "ja", name: "KL Group 管理者" },
  { code: "th", name: "KL Group ผู้ดูแลระบบ" },
];

(async () => {
  for (const { code, name } of LOCALES) {
    const tpl = passwordResetEmail({
      name,
      resetUrl: RESET_URL,
      expiresInMinutes: 60,
      locale: code,
    });
    const tagged = `[${code.toUpperCase()}] ${tpl.subject}`;
    process.stdout.write(`→ ${code} … `);
    const result = await sendEmail({
      to: TO,
      subject: tagged,
      html: tpl.html,
      text: tpl.text,
    });
    console.log(result.sent ? `OK ${result.id}` : `FAIL ${result.error}`);
    // Small spacing so Resend ratelimit (2 req/s) is happy
    await new Promise((r) => setTimeout(r, 700));
  }
})();
