# NoFlake Demo Script

## Goal

Show that NoFlake makes free-event attendance more reliable by using a refundable deposit, check-in, and transparent settlement.

## Demo Sequence

1. Open the homepage and frame the problem.
   Show `NoFlake` as the anti-no-show RSVP layer for free events.

2. Open the organizer flow at `/organizer`.
   Create a new event with title, venue, deposit, seat count, and cutoff time.

3. Open the attendee flow at `/events/evt_1`.
   Click `Connect wallet` to simulate a wallet session, then click `Reserve with USDC`.

4. Explain the commitment model.
   The attendee has locked a refundable deposit instead of paying for a ticket.

5. Open the organizer check-in flow at `/check-in/evt_1`.
   Check in `wallet-1`.

6. Click `Settle Event`.
   Show `Settlement complete` and explain:
   checked-in users are refunded, no-shows are forfeited in strict mode.

7. Close with the onchain angle.
   The current repo includes an Anchor scaffold that can evolve from demo orchestration into full onchain settlement.

## Short Talk Track

- Free events suffer from fake intent because RSVP is free.
- NoFlake adds a refundable deposit instead of a ticket purchase.
- Organizers get a clean check-in and settlement workflow.
- Attendees who show up get their money back.
- The system is designed to settle transparently on Solana.
