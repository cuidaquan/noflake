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

type ClaimInput = {
  event: Pick<EventRecord, "id" | "settlementMode" | "status" | "distributionStatus">;
  reservations: Array<
    Pick<
      ReservationRecord,
      "id" | "attendeeWallet" | "status" | "partyBonusClaimed" | "sponsorBonusClaimed"
    >
  >;
  attendeeWallet: string;
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
    },

    claimPartyBonus({ event, reservations, attendeeWallet }: ClaimInput) {
      if (event.settlementMode !== "PARTY") {
        throw new Error("Party bonus claims are only available for party events");
      }

      if (event.status !== "SETTLING" || event.distributionStatus === "PENDING") {
        throw new Error("Party distribution is not ready for claims");
      }

      const reservation = reservations.find(
        (candidate) => candidate.attendeeWallet === attendeeWallet
      );

      if (!reservation) {
        throw new Error(`Reservation not found for ${attendeeWallet}`);
      }

      if (reservation.status !== "REFUNDED") {
        throw new Error("This attendee is not eligible to claim the bonus");
      }

      if (reservation.partyBonusClaimed) {
        throw new Error("Party bonus already claimed");
      }

      reservation.partyBonusClaimed = true;
      const allClaimed = reservations
        .filter((candidate) => candidate.status === "REFUNDED")
        .every((candidate) => candidate.partyBonusClaimed);

      return {
        reservation,
        updatedEvent: {
          ...event,
          distributionStatus: allClaimed ? "COMPLETED" : "CLAIM_IN_PROGRESS"
        }
      };
    },

    claimSponsorBonus({ event, reservations, attendeeWallet }: ClaimInput) {
      if (event.settlementMode !== "SPONSOR") {
        throw new Error("Sponsor bonus claims are only available for sponsor events");
      }

      if (event.status !== "SETTLING" || event.distributionStatus === "PENDING") {
        throw new Error("Sponsor distribution is not ready for claims");
      }

      const reservation = reservations.find(
        (candidate) => candidate.attendeeWallet === attendeeWallet
      );

      if (!reservation) {
        throw new Error(`Reservation not found for ${attendeeWallet}`);
      }

      if (reservation.status !== "REFUNDED") {
        throw new Error("This attendee is not eligible to claim the bonus");
      }

      if (reservation.sponsorBonusClaimed) {
        throw new Error("Sponsor bonus already claimed");
      }

      reservation.sponsorBonusClaimed = true;
      const allClaimed = reservations
        .filter((candidate) => candidate.status === "REFUNDED")
        .every((candidate) => candidate.sponsorBonusClaimed);

      return {
        reservation,
        updatedEvent: {
          ...event,
          distributionStatus: allClaimed ? "COMPLETED" : "CLAIM_IN_PROGRESS"
        }
      };
    },

    finalizeEvent({ event, reservations }: PrepareInput) {
      if (event.settlementMode === "STRICT") {
        throw new Error("Strict events do not require a separate finalize step");
      }

      if (event.status !== "SETTLING" || event.distributionStatus !== "COMPLETED") {
        throw new Error("All eligible attendees must claim before finalize");
      }

      const eligibleReservations = reservations.filter(
        (reservation) => reservation.status === "REFUNDED"
      );
      const allClaimed = eligibleReservations.every((reservation) =>
        event.settlementMode === "PARTY"
          ? reservation.partyBonusClaimed
          : reservation.sponsorBonusClaimed
      );

      if (!allClaimed) {
        throw new Error("All eligible attendees must claim before finalize");
      }

      return {
        ...event,
        status: "SETTLED" as const
      };
    }
  };
}
