import type { EventRecord, ReservationRecord } from "../store/in-memory-store";

type SettleInput = {
  event: Pick<EventRecord, "id" | "settlementMode" | "status">;
  reservations: Array<Pick<ReservationRecord, "id" | "attendeeWallet" | "status" | "paidAmount">>;
};

type PrepareInput = {
  event: Pick<
    EventRecord,
    "id" | "settlementMode" | "status" | "distributionStatus" | "sponsorPoolFunded"
  >;
  reservations: Array<Pick<ReservationRecord, "id" | "attendeeWallet" | "status" | "paidAmount">>;
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
      const sponsorBonusPerAttendee =
        event.settlementMode === "SPONSOR" && checkedInReservations.length > 0
          ? 0
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
          event.settlementMode === "STRICT" ? noShowPool : 0,
        partyBonusPerAttendee,
        sponsorBonusPerAttendee,
        totalReturnedToAttendees:
          checkedInReservations.reduce((sum, reservation) => sum + reservation.paidAmount, 0) +
          partyBonusPerAttendee * checkedInReservations.length +
          sponsorBonusPerAttendee * checkedInReservations.length,
        distributionStatus: "COMPLETED" as const
      };
    },

    settleReservations({ event, reservations }: SettleInput) {
      const checkedInReservations = reservations.filter(
        (reservation) => reservation.status === "CHECKED_IN"
      );
      const reservedReservations = reservations.filter(
        (reservation) => reservation.status === "RESERVED"
      );

      const updatedReservations = reservations.map((reservation) => {
        if (reservation.status === "CHECKED_IN") {
          return { ...reservation, status: "REFUNDED" as const };
        }

        if (reservation.status === "RESERVED") {
          if (event.settlementMode === "PARTY") {
            return { ...reservation, status: "NO_SHOW" as const };
          }

          return { ...reservation, status: "FORFEITED" as const };
        }

        return reservation;
      });

      return {
        updatedReservations,
        summary: {
          eventId: event.id,
          checkedInCount: checkedInReservations.length,
          noShowCount: reservedReservations.length,
          refundedAmount: checkedInReservations.reduce(
            (sum, reservation) => sum + reservation.paidAmount,
            0
          ),
          forfeitedAmount:
            event.settlementMode === "STRICT" || event.settlementMode === "SPONSOR"
              ? reservedReservations.reduce((sum, reservation) => sum + reservation.paidAmount, 0)
              : 0,
          distributionStatus:
            event.settlementMode === "STRICT" ? "COMPLETED" : "PENDING" as const
        }
      };
    },

    preparePartyDistribution({ event, reservations }: PrepareInput) {
      if (event.status !== "SETTLING") {
        throw new Error("Event is not ready to finalize");
      }

      const checkedInCount = reservations.filter(
        (reservation) => reservation.status === "REFUNDED"
      ).length;
      const poolAmount = reservations
        .filter((reservation) => reservation.status === "NO_SHOW")
        .reduce((sum, reservation) => sum + reservation.paidAmount, 0);
      const partyBonusPerAttendee = checkedInCount > 0 ? Math.floor(poolAmount / checkedInCount) : 0;

      return {
        updatedEvent: {
          ...event,
          distributionStatus: checkedInCount > 0 ? "CLAIM_IN_PROGRESS" : "COMPLETED",
          partyBonusPerAttendee
        },
        summary: {
          eventId: event.id,
          checkedInCount,
          noShowCount: reservations.filter((reservation) => reservation.status === "NO_SHOW").length,
          refundedAmount: reservations
            .filter((reservation) => reservation.status === "REFUNDED")
            .reduce((sum, reservation) => sum + reservation.paidAmount, 0),
          forfeitedAmount: 0,
          partyBonusPerAttendee,
          totalReturnedToAttendees:
            reservations
              .filter((reservation) => reservation.status === "REFUNDED")
              .reduce((sum, reservation) => sum + reservation.paidAmount, 0) +
            partyBonusPerAttendee * checkedInCount,
          distributionStatus: checkedInCount > 0 ? "CLAIM_IN_PROGRESS" : "COMPLETED"
        }
      };
    },

    prepareSponsorDistribution({ event, reservations }: PrepareInput) {
      if (event.status !== "SETTLING") {
        throw new Error("Event is not ready to finalize");
      }

      const checkedInCount = reservations.filter(
        (reservation) => reservation.status === "REFUNDED"
      ).length;
      const sponsorPoolFunded = event.sponsorPoolFunded ?? 0;
      const sponsorBonusPerAttendee =
        checkedInCount > 0 ? Math.floor(sponsorPoolFunded / checkedInCount) : 0;

      return {
        updatedEvent: {
          ...event,
          distributionStatus: checkedInCount > 0 ? "CLAIM_IN_PROGRESS" : "COMPLETED",
          sponsorBonusPerAttendee
        },
        summary: {
          eventId: event.id,
          checkedInCount,
          noShowCount: reservations.filter((reservation) => reservation.status === "FORFEITED").length,
          refundedAmount: reservations
            .filter((reservation) => reservation.status === "REFUNDED")
            .reduce((sum, reservation) => sum + reservation.paidAmount, 0),
          forfeitedAmount: reservations
            .filter((reservation) => reservation.status === "FORFEITED")
            .reduce((sum, reservation) => sum + reservation.paidAmount, 0),
          sponsorBonusPerAttendee,
          totalReturnedToAttendees:
            reservations
              .filter((reservation) => reservation.status === "REFUNDED")
              .reduce((sum, reservation) => sum + reservation.paidAmount, 0) +
            sponsorBonusPerAttendee * checkedInCount,
          distributionStatus: checkedInCount > 0 ? "CLAIM_IN_PROGRESS" : "COMPLETED"
        }
      };
    }
  };
}
