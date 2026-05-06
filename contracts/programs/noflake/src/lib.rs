use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

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
        event.bump = ctx.bumps.event;
        Ok(())
    }

    pub fn reserve_seat(ctx: Context<ReserveSeat>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        reservation.event = event.key();
        reservation.attendee = ctx.accounts.attendee.key();
        reservation.status = ReservationStatus::Reserved;
        reservation.paid_amount = event.deposit_amount;
        reservation.bump = ctx.bumps.reservation;

        event.reserved_count = event.reserved_count.saturating_add(1);
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        reservation.status = ReservationStatus::CheckedIn;
        event.checked_in_count = event.checked_in_count.saturating_add(1);
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
    pub reserved_count: u16,
    pub checked_in_count: u16,
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
    CheckedIn,
    Refunded,
    Forfeited,
}
