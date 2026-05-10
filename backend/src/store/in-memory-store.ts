import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  DistributionStatus,
  EventStatus,
  ReservationStatus,
  SettlementMode
} from "@noflake/shared";

export type EventRecord = {
  id: string;
  title: string;
  hostWallet: string;
  creationPath?: "DEMO_BACKEND" | "BROWSER_WALLET";
  hostAuthorizationMessage?: string;
  hostWalletAuthorization?: string;
  venue: string;
  startTime: string;
  depositAmount: number;
  seatCount: number;
  cutoffTime: string;
  settlementMode: SettlementMode;
  sponsorPoolAmount?: number;
  sponsorPoolFunded?: number;
  partyBonusPerAttendee?: number;
  sponsorBonusPerAttendee?: number;
  distributionStatus?: DistributionStatus;
  status: EventStatus;
};

export type ReservationRecord = {
  id: string;
  eventId: string;
  attendeeWallet: string;
  paymentPath?: "DEMO_BACKEND" | "BROWSER_WALLET";
  walletAuthorizationMessage?: string;
  walletAuthorization?: string;
  status: ReservationStatus;
  paidAmount: number;
  createdAt: string;
  checkedInAt: string | null;
  waitlistOrder: number | null;
  partyBonusClaimed?: boolean;
  sponsorBonusClaimed?: boolean;
};

export type InMemoryStore = {
  events: EventRecord[];
  reservations: ReservationRecord[];
};

type StoreSnapshot = Pick<InMemoryStore, "events" | "reservations">;

const backingStore: InMemoryStore = {
  events: [],
  reservations: []
};

function cloneSnapshot(snapshot: StoreSnapshot): StoreSnapshot {
  return {
    events: snapshot.events.map((event) => ({ ...event })),
    reservations: snapshot.reservations.map((reservation) => ({ ...reservation }))
  };
}

function applySnapshot(snapshot: StoreSnapshot): InMemoryStore {
  const cloned = cloneSnapshot(snapshot);
  backingStore.events = cloned.events;
  backingStore.reservations = cloned.reservations;
  return backingStore;
}

export function createInMemoryStore(initialState?: Partial<StoreSnapshot>): InMemoryStore {
  if (initialState) {
    return applySnapshot({
      events: initialState.events ?? [],
      reservations: initialState.reservations ?? []
    });
  }

  return backingStore;
}

export function readStoreFromFile(filePath: string): InMemoryStore {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreSnapshot>;

    return createInMemoryStore({
      events: Array.isArray(parsed.events) ? parsed.events : [],
      reservations: Array.isArray(parsed.reservations) ? parsed.reservations : []
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return resetInMemoryStore();
    }

    throw error;
  }
}

export function writeStoreToFile(filePath: string, store: InMemoryStore = backingStore) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        events: store.events,
        reservations: store.reservations
      },
      null,
      2
    ),
    "utf8"
  );
}

export function resetInMemoryStore() {
  backingStore.events = [];
  backingStore.reservations = [];
  return backingStore;
}
