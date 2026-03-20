export {
  formatCurrency,
  formatDate,
  formatDateTime,
  truncate,
  display,
} from "../lib/utils";

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(value);
  }
}
