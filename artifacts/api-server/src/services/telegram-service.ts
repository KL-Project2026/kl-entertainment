let botInitialized = false;

const LANG_BUTTONS = [
  [
    { text: "🇬🇧 English", callback_data: "lang_en" },
    { text: "🇨🇳 中文", callback_data: "lang_zh" },
  ],
  [
    { text: "🇲🇾 Bahasa", callback_data: "lang_ms" },
    { text: "🇰🇷 한국어", callback_data: "lang_ko" },
  ],
  [
    { text: "🇯🇵 日本語", callback_data: "lang_ja" },
    { text: "🇹🇭 ภาษาไทย", callback_data: "lang_th" },
  ],
];

async function telegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function initTelegramBot(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  if (botInitialized) return;

  const webhookUrl = process.env["TELEGRAM_WEBHOOK_URL"];
  if (webhookUrl) {
    await telegramApi("setWebhook", { url: `${webhookUrl}/api/webhooks/telegram` });
    console.log("[telegram] Webhook set to:", webhookUrl);
  } else {
    console.warn("[telegram] TELEGRAM_WEBHOOK_URL not set — webhook not configured");
  }
  botInitialized = true;
}

export async function handleTelegramUpdate(update: Record<string, unknown>): Promise<void> {
  const message = update.message as Record<string, unknown> | undefined;
  const callbackQuery = update.callback_query as Record<string, unknown> | undefined;

  if (message) {
    const chatId = (message.chat as Record<string, unknown>).id;
    const text = message.text as string | undefined;

    if (text === "/start") {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Welcome to KL Entertainment 🎤\nSelect language:",
        reply_markup: { inline_keyboard: LANG_BUTTONS },
      });
    } else if (text === "/book") {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "To book a room, please visit our customer portal:\n🌐 Visit our website and log in with your account.",
      });
    } else if (text === "/mybookings") {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Please log in to the customer portal to view your bookings.",
      });
    } else if (text) {
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: "Commands:\n/start — Welcome\n/book — Make a booking\n/mybookings — View your bookings",
      });
    }
  }

  if (callbackQuery) {
    const chatId = ((callbackQuery.message as Record<string, unknown>).chat as Record<string, unknown>).id;
    const data = callbackQuery.data as string;

    if (data.startsWith("lang_")) {
      const lang = data.replace("lang_", "");
      const langNames: Record<string, string> = {
        en: "English", zh: "中文", ms: "Bahasa", ko: "한국어", ja: "日本語", th: "ภาษาไทย",
      };
      await telegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });
      await telegramApi("sendMessage", {
        chat_id: chatId,
        text: `Language set to ${langNames[lang] ?? lang}. Welcome to KL Entertainment! 🎤\n\nUse /book to make a reservation.`,
      });
    }
  }
}
