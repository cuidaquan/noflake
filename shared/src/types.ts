export type SettlementMode = "STRICT" | "PARTY" | "SPONSOR";

export type EventStatus =
  | "DRAFT"
  | "OPEN"
  | "FULL"
  | "IN_PROGRESS"
  | "SETTLING"
  | "SETTLED"
  | "CANCELLED";

export type ReservationStatus =
  | "RESERVED"
  | "WAITLISTED"
  | "CANCELLED"
  | "CHECKED_IN"
  | "NO_SHOW"
  | "REFUNDED"
  | "FORFEITED";
