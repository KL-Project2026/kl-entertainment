// MIGRATION: convert to EF Core repository pattern

export interface CategoryMaskInfo {
  visibility_level:     string;
  invoice_display_mode: string;
  invoice_alias:        string | null;
}

export interface OrderItemMaskInput {
  id:          string;
  description: string;
}

/**
 * Returns the display name to use on customer-facing invoices / receipts.
 * For ALL-visibility categories the real description is always returned.
 * For special categories the name is replaced according to the category's
 * invoice_display_mode setting so the real item name is never revealed.
 */
export function getMaskedDisplayName(
  category: CategoryMaskInfo | null | undefined,
  orderItem: OrderItemMaskInput,
): string {
  if (!category || category.visibility_level === "ALL") {
    return orderItem.description;
  }
  switch (category.invoice_display_mode) {
    case "MASKED_CODE":
      return `SVC-${String(orderItem.id.slice(0, 3)).toUpperCase().padStart(3, "0")}`;
    case "MASKED_SYMBOL":
      return "XXXX";
    case "CUSTOM_ALIAS":
      return category.invoice_alias || "■■■■";
    default:
      return orderItem.description;
  }
}

/**
 * Returns the category display label for invoice line items.
 * Hidden for special categories.
 */
export function getMaskedCategoryDisplay(category: CategoryMaskInfo | null | undefined): string {
  if (!category || category.visibility_level === "ALL") return "";
  return "—";
}
