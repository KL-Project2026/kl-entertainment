const WHATSAPP_API = "https://graph.facebook.com/v18.0";

function formatDate(isoString: string, lang: string): string {
  const date = new Date(isoString);
  const locale = lang === "zh" ? "zh-CN" : lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : lang === "th" ? "th-TH" : lang === "ms" ? "ms-MY" : "en-US";
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

interface ReservationInfo {
  reservation_no: string;
  start_time: string;
  room_name: string;
  guest_count: number;
  customer_phone?: string | null;
}

interface ReceiptInfo {
  receipt_no: string;
  payment_at: string;
  customer_phone?: string | null;
  total_amount: number;
  payment_method: string;
}

async function sendMessage(phone: string, body: string): Promise<void> {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];

  if (!token || !phoneNumberId) {
    console.warn("[whatsapp] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — skipping send");
    return;
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "");
  if (!cleanPhone) return;

  try {
    const res = await fetch(`${WHATSAPP_API}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone.startsWith("60") ? cleanPhone : `60${cleanPhone}`,
        type: "text",
        text: { body },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[whatsapp] Send failed:", err);
    }
  } catch (err) {
    console.error("[whatsapp] Network error:", err);
  }
}

export async function sendBookingConfirmation(reservation: ReservationInfo, lang = "en"): Promise<void> {
  if (!reservation.customer_phone) return;

  const messages: Record<string, string> = {
    en: `✅ *Booking Confirmed!*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "en")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count} guests\n\nReply CANCEL to cancel.`,
    zh: `✅ *预订已确认！*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "zh")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count} 位客人`,
    ko: `✅ *예약 확인*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "ko")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count}명`,
    ms: `✅ *Tempahan Disahkan!*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "ms")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count} tetamu`,
    ja: `✅ *ご予約確認*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "ja")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count}名様`,
    th: `✅ *ยืนยันการจอง*\n\n📋 *${reservation.reservation_no}*\n📅 ${formatDate(reservation.start_time, "th")}\n🏠 ${reservation.room_name}\n👥 ${reservation.guest_count} คน`,
  };

  const body = messages[lang] ?? messages["en"]!;
  await sendMessage(reservation.customer_phone, body);
}

export async function sendReceiptWhatsApp(receipt: ReceiptInfo): Promise<void> {
  if (!receipt.customer_phone) return;
  const message =
    `🧾 *Receipt ${receipt.receipt_no}*\n\n` +
    `Total: MYR ${Number(receipt.total_amount).toFixed(2)}\n` +
    `Payment: ${receipt.payment_method}\n` +
    `Date: ${new Date(receipt.payment_at).toLocaleString()}\n\n` +
    `Thank you for visiting! 🙏`;

  await sendMessage(receipt.customer_phone, message);
}
