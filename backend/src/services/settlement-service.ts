import type { ReservationStatus, SettlementMode } from "@noflake/shared";

type SettlementReservation = {
  id: string;
  attendeeWallet: string;
  status: ReservationStatus;
  paidAmount: number;
};

type SettlementEvent = {
  id: string;
  settlementMode: SettlementMode;
};

type SettleInput = {
  event: SettlementEvent;
  reservations: SettlementReservation[];
};

export function createSettlementService() {
  return {
    settle({ event, reservations }: SettleInput) {
      const checkedInReservations = reservations.filter(
        (reservation) => reservation.status === "CHECKED_IN"
      );
      const noShowReservations = reservations.filter(
        (reservation) => reservation.status === "RESERVED"
      );
      const noShowPool = noShowReservations.reduce(
        (sum, reservation) => sum + reservation.paidAmount,
        0
      );
      const partyBonusPerAttendee =
        event.settlementMode === "PARTY" && checkedInReservations.length > 0
          ? noShowPool / checkedInReservations.length
          : 0;

      return {
        eventId: event.id,
        checkedInCount: checkedInReservations.length,
        noShowCount: noShowReservations.length,
        refundedAmount: checkedInReservations.reduce(
          (sum, reservation) => sum + reservation.paidAmount,
          0
        ),
        forfeitedAmount:
          event.settlementMode === "STRICT"
            ? noShowPool
            : 0,
        partyBonusPerAttendee,
        totalReturnedToAttendees:
          checkedInReservations.reduce((sum, reservation) => sum + reservation.paidAmount, 0) +
          partyBonusPerAttendee * checkedInReservations.length,
        distributionStatus: "COMPLETED" as const
      };
    }
  };
}
