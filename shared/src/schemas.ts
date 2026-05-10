import { z } from "zod";

const settlementModeSchema = z.enum(["STRICT", "PARTY", "SPONSOR"]);
const eventStatusSchema = z.enum([
  "DRAFT",
  "OPEN",
  "FULL",
  "IN_PROGRESS",
  "SETTLING",
  "SETTLED",
  "CANCELLED"
]);
const reservationStatusSchema = z.enum([
  "RESERVED",
  "WAITLISTED",
  "CANCELLED",
  "CHECKED_IN",
  "NO_SHOW",
  "REFUNDED",
  "FORFEITED"
]);

export const eventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  hostWallet: z.string().min(1),
  venue: z.string().min(1),
  startTime: z.string().datetime(),
  depositAmount: z.number().nonnegative(),
  seatCount: z.number().int().positive(),
  cutoffTime: z.string().datetime(),
  settlementMode: settlementModeSchema,
  status: eventStatusSchema
});

export const reservationSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  attendeeWallet: z.string().min(1),
  status: reservationStatusSchema,
  paidAmount: z.number().nonnegative()
});

export const settlementSummarySchema = z.object({
  eventId: z.string().min(1),
  checkedInCount: z.number().int().nonnegative(),
  noShowCount: z.number().int().nonnegative(),
  refundedAmount: z.number().nonnegative(),
  forfeitedAmount: z.number().nonnegative(),
  partyBonusPerAttendee: z.number().nonnegative().optional(),
  sponsorBonusPerAttendee: z.number().nonnegative().optional(),
  totalReturnedToAttendees: z.number().nonnegative().optional(),
  distributionStatus: z.enum(["PENDING", "PREPARED", "CLAIM_IN_PROGRESS", "COMPLETED"])
});
