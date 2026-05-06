use anchor_lang::prelude::*;

declare_id!("F5umdtne4aMhcmPpeV8G8ap1EhMe79mqUJET8EVJUmcA");

#[program]
pub mod noflake {
    use super::*;

    pub fn initialize_event(
        ctx: Context<InitializeEvent>,
        title: String,
        venue: String,
        start_time: i64,
        cutoff_time: i64,
        deposit_amount: u64,
        seat_count: u16,
        settlement_mode: SettlementMode,
    ) -> Result<()> {
        let event = &mut ctx.accounts.event;
        event.host = ctx.accounts.host.key();
        event.title = title;
        event.venue = venue;
        event.start_time = start_time;
        event.cutoff_time = cutoff_time;
        event.deposit_amount = deposit_amount;
        event.seat_count = seat_count;
        event.reserved_count = 0;
        event.checked_in_count = 0;
        event.settlement_mode = settlement_mode;
        event.status = EventStatus::Open;
        event.bump = ctx.bumps.event;
        Ok(())
    }

    pub fn reserve_seat(ctx: Context<ReserveSeat>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        require!(
            matches!(event.status, EventStatus::Open | EventStatus::Full),
            NoflakeError::EventNotAcceptingReservations
        );

        reservation.event = event.key();
        reservation.attendee = ctx.accounts.attendee.key();
        reservation.paid_amount = event.deposit_amount;
        reservation.bump = ctx.bumps.reservation;

        if event.reserved_count < event.seat_count {
            reservation.status = ReservationStatus::Reserved;
            event.reserved_count = event.reserved_count.saturating_add(1);

            if event.reserved_count >= event.seat_count {
                event.status = EventStatus::Full;
            }
        } else {
            reservation.status = ReservationStatus::Waitlisted;
            event.status = EventStatus::Full;
        }

        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        require!(
            matches!(
                event.status,
                EventStatus::Open | EventStatus::Full | EventStatus::InProgress
            ),
            NoflakeError::EventCheckInClosed
        );

        require!(
            reservation.status == ReservationStatus::Reserved,
            NoflakeError::ReservationNotReserved
        );

        reservation.status = ReservationStatus::CheckedIn;
        event.checked_in_count = event.checked_in_count.saturating_add(1);
        event.status = EventStatus::InProgress;
        Ok(())
    }

    pub fn settle_reservation(ctx: Context<SettleReservation>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        require!(
            matches!(
                event.status,
                EventStatus::Open
                    | EventStatus::Full
                    | EventStatus::InProgress
                    | EventStatus::Settling
            ),
            NoflakeError::EventSettlementClosed
        );

        reservation.status = match reservation.status {
            ReservationStatus::CheckedIn => ReservationStatus::Refunded,
            ReservationStatus::Reserved => match event.settlement_mode {
                SettlementMode::Strict => ReservationStatus::Forfeited,
                SettlementMode::Party | SettlementMode::Sponsor => ReservationStatus::NoShow,
            },
            ReservationStatus::Refunded
            | ReservationStatus::Forfeited
            | ReservationStatus::NoShow => {
                return err!(NoflakeError::ReservationAlreadySettled);
            }
            ReservationStatus::Waitlisted | ReservationStatus::Cancelled => {
                return err!(NoflakeError::ReservationNotSettleable);
            }
        };

        event.status = EventStatus::Settling;
        Ok(())
    }

    pub fn finalize_event(ctx: Context<FinalizeEvent>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!(
            event.status != EventStatus::Settled,
            NoflakeError::EventAlreadySettled
        );
        require!(
            event.status == EventStatus::Settling,
            NoflakeError::EventNotReadyToFinalize
        );

        event.status = EventStatus::Settled;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeEvent<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = 8 + EventAccount::INIT_SPACE,
        seeds = [b"event", host.key().as_ref()],
        bump
    )]
    pub event: Account<'info, EventAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReserveSeat<'info> {
    #[account(mut)]
    pub attendee: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, EventAccount>,
    #[account(
        init,
        payer = attendee,
        space = 8 + ReservationAccount::INIT_SPACE,
        seeds = [b"reservation", event.key().as_ref(), attendee.key().as_ref()],
        bump
    )]
    pub reservation: Account<'info, ReservationAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    #[account(mut, has_one = event)]
    pub reservation: Account<'info, ReservationAccount>,
}

#[derive(Accounts)]
pub struct SettleReservation<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    #[account(mut, has_one = event)]
    pub reservation: Account<'info, ReservationAccount>,
}

#[derive(Accounts)]
pub struct FinalizeEvent<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct EventAccount {
    pub host: Pubkey,
    #[max_len(64)]
    pub title: String,
    #[max_len(64)]
    pub venue: String,
    pub start_time: i64,
    pub cutoff_time: i64,
    pub deposit_amount: u64,
    pub seat_count: u16,
    pub settlement_mode: SettlementMode,
    pub reserved_count: u16,
    pub checked_in_count: u16,
    pub status: EventStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReservationAccount {
    pub event: Pubkey,
    pub attendee: Pubkey,
    pub status: ReservationStatus,
    pub paid_amount: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum ReservationStatus {
    Reserved,
    Waitlisted,
    Cancelled,
    CheckedIn,
    NoShow,
    Refunded,
    Forfeited,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum SettlementMode {
    Strict,
    Party,
    Sponsor,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, PartialEq, Eq)]
pub enum EventStatus {
    Draft,
    Open,
    Full,
    InProgress,
    Settling,
    Settled,
    Cancelled,
}

#[error_code]
pub enum NoflakeError {
    #[msg("Reservation must be in reserved state.")]
    ReservationNotReserved,
    #[msg("Reservation has already been settled.")]
    ReservationAlreadySettled,
    #[msg("Reservation cannot be settled from its current state.")]
    ReservationNotSettleable,
    #[msg("Event has already been settled.")]
    EventAlreadySettled,
    #[msg("Event is not accepting new reservations.")]
    EventNotAcceptingReservations,
    #[msg("Event check-in is closed.")]
    EventCheckInClosed,
    #[msg("Event settlement is closed.")]
    EventSettlementClosed,
    #[msg("Event is not ready to finalize.")]
    EventNotReadyToFinalize,
}
