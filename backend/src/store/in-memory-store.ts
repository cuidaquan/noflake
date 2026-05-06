import type { EventStatus, ReservationStatus, SettlementMode } from "@noflake/shared";

export type EventRecord = {
  id: string;
  title: string;
  hostWallet: string;
  venue: string;
  startTime: string;
  depositAmount: number;
  seatCount: number;
  cutoffTime: string;
  settlementMode: SettlementMode;
  status: EventStatus;
};

export type ReservationRecord = {
  id: string;
  eventId: string;
  attendeeWallet: string;
  status: ReservationStatus;
  paidAmount: number;
};

export type InMemoryStore = {
  events: EventRecord[];
  reservations: ReservationRecord[];
};

export function createInMemoryStore(): InMemoryStore {
  return {
    events: [],
    reservations: []
  };
}
