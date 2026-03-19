import { pool } from "@workspace/db";

const FX_CACHE_TTL_MS = 60 * 60 * 1000;
let lastFetchTime = 0;

const SUPPORTED_CURRENCIES = ["AUD", "KRW", "JPY", "CNY", "USD", "SGD", "THB"];

export async function refreshFxRates(): Promise<void> {
  const now = Date.now();
  if (now - lastFetchTime < FX_CACHE_TTL_MS) return;

  const apiKey = process.env["EXCHANGERATE_API_KEY"];
  if (!apiKey) {
    console.warn("[currency] EXCHANGERATE_API_KEY not set — skipping FX refresh");
    return;
  }

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/MYR`);
    const data = (await res.json()) as { result: string; conversion_rates: Record<string, number> };

    if (data.result !== "success") {
      console.error("[currency] FX API error:", data);
      return;
    }

    for (const ccy of SUPPORTED_CURRENCIES) {
      const rate = data.conversion_rates[ccy];
      if (!rate) continue;
      await pool.query(
        `INSERT INTO fx_rates (base_ccy, quote_ccy, rate, fetched_at)
         VALUES ('MYR', $1, $2, NOW())
         ON CONFLICT (base_ccy, quote_ccy) DO UPDATE SET rate = $2, fetched_at = NOW()`,
        [ccy, rate]
      );
    }
    lastFetchTime = now;
    console.log("[currency] FX rates refreshed successfully");
  } catch (err) {
    console.error("[currency] FX refresh failed:", err);
  }
}

export async function getFxRates(): Promise<Record<string, number>> {
  await refreshFxRates();
  const { rows } = await pool.query<{ quote_ccy: string; rate: string; fetched_at: Date }>(
    `SELECT quote_ccy, rate, fetched_at FROM fx_rates WHERE base_ccy = 'MYR' ORDER BY quote_ccy`
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[`MYR_${row.quote_ccy.trim()}`] = parseFloat(row.rate);
  }
  return result;
}

export async function convertAmount(
  amountMyr: number,
  toCurrency: string
): Promise<{ amount: number; rate: number; note?: string }> {
  if (toCurrency === "MYR") return { amount: amountMyr, rate: 1.0 };

  await refreshFxRates();
  const { rows } = await pool.query<{ rate: string }>(
    `SELECT rate FROM fx_rates WHERE base_ccy = 'MYR' AND TRIM(quote_ccy) = $1`,
    [toCurrency]
  );
  const rate = parseFloat(rows[0]?.rate ?? "1");
  return {
    amount: Math.round(amountMyr * rate * 100) / 100,
    rate,
    note: `Reference rate: 1 MYR = ${rate} ${toCurrency}`,
  };
}
