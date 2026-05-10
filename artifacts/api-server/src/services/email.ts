import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

const FROM = process.env.EMAIL_FROM || "KL Entertainment <onboarding@resend.dev>";

export type SendResult = { id: string | null; sent: boolean; error?: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — email not sent:", opts.subject);
    return { id: null, sent: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return { id: null, sent: false, error: error.message };
    }
    return { id: data?.id ?? null, sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] send threw:", msg);
    return { id: null, sent: false, error: msg };
  }
}
