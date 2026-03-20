export const ROLES = {
  SUPER_ADMIN:   "super_admin",
  ADMIN:         "admin",
  INVESTOR:      "investor",
  BRANCH_MANAGER:"branch_manager",
  MANAGER:       "manager",
  HOSTESS:       "hostess",
  DRIVER:        "driver",
  KITCHEN:       "kitchen",
  HALL:          "hall",
  GENERAL:       "general",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Hierarchy level — higher number = more privilege
export const ROLE_LEVEL: Record<string, number> = {
  super_admin:   100,
  admin:          80,
  investor:       70,
  branch_manager: 60,
  manager:        55,
  hostess:        40,
  driver:         30,
  kitchen:        30,
  hall:           30,
  general:        20,
};

// Table-level permission matrix
export const TABLE_PERMISSIONS: Record<string, Record<string, string>> = {
  investor: {
    investor_reports: "READ",
    branches:         "READ",
  },
  admin: {
    branches:         "FULL",
    rooms:            "FULL",
    reservations:     "FULL",
    customers:        "FULL",
    staff:            "FULL",
    agents:           "FULL",
    payments:         "READ",
    invoices:         "FULL",
    audit_logs:       "READ",
    investor_reports: "FULL",
  },
  branch_manager: {
    rooms:            "FULL",
    reservations:     "FULL",
    customers:        "MANAGE",
    staff:            "MANAGE",
    attendance:       "FULL",
    agents:           "READ",
    payments:         "READ",
    invoices:         "FULL",
  },
};

export const RESERVATION_STATUSES = {
  TENTATIVE: "tentative",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  EXTENDED: "extended",
  CHECKED_OUT: "checked_out",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
} as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[keyof typeof RESERVATION_STATUSES];

export const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  tentative: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["extended", "checked_out"],
  extended: ["checked_in", "checked_out"],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

export const PAYMENT_METHODS = [
  "cash",
  "qr_touchngo",
  "qr_grabpay",
  "fpx",
  "card",
  "credit_account",
  "bank_transfer",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SUPPORTED_LANGUAGES = ["en", "zh", "ms", "ja", "ko", "th"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SUPPORTED_CURRENCIES = ["MYR", "AUD", "KRW", "JPY", "CNY"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY = "MYR";
export const DEFAULT_TIMEZONE = "Asia/Kuala_Lumpur";
export const DEFAULT_LANG = "en";

export const ROOM_TYPES = ["private_room", "vip_room", "vvip_room", "table", "open_area"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_STATUSES = ["available", "occupied", "cleaning", "maintenance", "blocked"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const BOOKING_CHANNELS = ["walk_in", "customer_app", "whatsapp", "telegram", "phone", "agent"] as const;
export type BookingChannel = (typeof BOOKING_CHANNELS)[number];

export const PAYMENT_STATUSES = ["pending", "partial", "paid", "credit", "refunded", "voided"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const AGENT_TYPES = ["agency", "travel_agent", "uber", "taxi", "personal", "online"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const COMMISSION_TYPES = ["pct", "fixed_per_booking", "credit_accumulate"] as const;
export type CommissionType = (typeof COMMISSION_TYPES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "freelance"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "early_leave", "no_show", "day_off", "sick"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const CUSTOMER_PAYMENT_TYPES = ["standard", "monthly_billing", "credit_account"] as const;
export type CustomerPaymentType = (typeof CUSTOMER_PAYMENT_TYPES)[number];

export const ORDER_ITEM_TYPES = [
  "product",
  "room_charge",
  "hostess_fee",
  "pickup_fee",
  "extension_charge",
  "discount",
  "other",
] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "rent",
  "utilities",
  "salary",
  "hostess_commission",
  "agent_commission",
  "referral_credit",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const SETTLEMENT_STATUSES = ["draft", "approved", "paid"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];
