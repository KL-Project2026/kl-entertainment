/**
 * One-off: send a Quiet-Luxury password-reset SAMPLE email to klproject.com@gmail.com
 * to validate Resend credentials and the design template.
 *
 * Run from api-server: tsx scripts/send-sample-email.ts
 */
import { sendEmail } from "../src/services/email";
import { passwordResetEmail } from "../src/services/email-templates";

const TO = "klproject.com@gmail.com";

const tpl = passwordResetEmail({
  name: "KL Group Admin",
  resetUrl: "https://app.kl-project.com/reset-password?token=SAMPLE_TOKEN_FOR_DESIGN_PREVIEW",
  expiresInMinutes: 60,
});

(async () => {
  console.log(`Sending sample password-reset email to ${TO}…`);
  const result = await sendEmail({
    to: TO,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.sent) process.exit(1);
})();
