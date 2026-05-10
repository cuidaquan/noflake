use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

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
        deposit_mint: Pubkey,
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
        event.active_count = 0;
        event.checked_in_count = 0;
        event.settled_count = 0;
        event.next_waitlist_order = 1;
        event.next_waitlist_to_promote = 1;
        event.settlement_mode = settlement_mode;
        event.deposit_mint = deposit_mint;
        event.status = EventStatus::Open;
        event.party_bonus_per_attendee = 0;
        event.party_bonus_prepared = false;
        event.party_bonus_claimed_count = 0;
        event.sponsor = None;
        event.sponsor_bonus_per_attendee = 0;
        event.sponsor_distribution_prepared = false;
        event.sponsor_bonus_claimed_count = 0;
        event.sponsor_vault_authority_bump = ctx.bumps.sponsor_vault_authority;
        event.vault_authority_bump = ctx.bumps.vault_authority;
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
        require!(
            ctx.accounts.deposit_mint_account.key() == event.deposit_mint,
            NoflakeError::InvalidDepositMint
        );

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.attendee_deposit_token.to_account_info(),
                    mint: ctx.accounts.deposit_mint_account.to_account_info(),
                    to: ctx.accounts.event_vault_token.to_account_info(),
                    authority: ctx.accounts.attendee.to_account_info(),
                },
            ),
            event.deposit_amount,
            ctx.accounts.deposit_mint_account.decimals,
        )?;

        reservation.event = event.key();
        reservation.attendee = ctx.accounts.attendee.key();
        reservation.paid_amount = event.deposit_amount;
        reservation.party_bonus_claimed = false;
        reservation.bump = ctx.bumps.reservation;

        if event.reserved_count < event.seat_count {
            reservation.status = ReservationStatus::Reserved;
            event.reserved_count = event.reserved_count.saturating_add(1);
            event.active_count = event.active_count.saturating_add(1);
            reservation.waitlist_order = 0;

            if event.reserved_count >= event.seat_count {
                event.status = EventStatus::Full;
            }
        } else {
            reservation.status = ReservationStatus::Waitlisted;
            reservation.waitlist_order = event.next_waitlist_order;
            event.next_waitlist_order = event.next_waitlist_order.saturating_add(1);
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
            event.settled_count == 0,
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

    pub fn undo_check_in(ctx: Context<UndoCheckIn>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        require!(
            matches!(event.status, EventStatus::Open | EventStatus::Full | EventStatus::InProgress),
            NoflakeError::EventCheckInClosed
        );
        require!(
            event.settled_count == 0,
            NoflakeError::EventCheckInClosed
        );
        require!(
            reservation.status == ReservationStatus::CheckedIn,
            NoflakeError::ReservationNotCheckedIn
        );

        reservation.status = ReservationStatus::Reserved;
        event.checked_in_count = event.checked_in_count.saturating_sub(1);
        event.status = if event.reserved_count >= event.seat_count {
            EventStatus::Full
        } else {
            EventStatus::Open
        };

        Ok(())
    }

    pub fn cancel_reservation(ctx: Context<CancelReservation>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;
        require!(
            matches!(event.status, EventStatus::Open | EventStatus::Full),
            NoflakeError::ReservationNotCancellable
        );
        require!(
            matches!(
                reservation.status,
                ReservationStatus::Reserved | ReservationStatus::Waitlisted
            ),
            NoflakeError::ReservationNotCancellable
        );
        require!(
            Clock::get()?.unix_timestamp < event.cutoff_time,
            NoflakeError::ReservationCancellationClosed
        );
        require!(
            ctx.accounts.deposit_mint_account.key() == event.deposit_mint,
            NoflakeError::InvalidDepositMint
        );

        let cancelled_reserved = reservation.status == ReservationStatus::Reserved;
        let cancelled_waitlist_order = reservation.waitlist_order;

        transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.event_vault_token.to_account_info(),
                    mint: ctx.accounts.deposit_mint_account.to_account_info(),
                    to: ctx.accounts.attendee_deposit_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                &[&[
                    b"vault",
                    event.key().as_ref(),
                    &[event.vault_authority_bump],
                ]],
            ),
            reservation.paid_amount,
            ctx.accounts.deposit_mint_account.decimals,
        )?;

        reservation.status = ReservationStatus::Cancelled;
        reservation.waitlist_order = 0;

        if cancelled_reserved {
            event.reserved_count = event.reserved_count.saturating_sub(1);
            event.active_count = event.active_count.saturating_sub(1);

            if let Some(promoted_reservation) = ctx.accounts.promoted_reservation.as_deref_mut() {
                require!(
                    promoted_reservation.event == event.key(),
                    NoflakeError::InvalidWaitlistPromotion
                );
                require!(
                    promoted_reservation.status == ReservationStatus::Waitlisted,
                    NoflakeError::InvalidWaitlistPromotion
                );
                require!(
                    promoted_reservation.waitlist_order == event.next_waitlist_to_promote,
                    NoflakeError::InvalidWaitlistPromotion
                );

                promoted_reservation.status = ReservationStatus::Reserved;
                promoted_reservation.waitlist_order = 0;
                event.next_waitlist_to_promote =
                    event.next_waitlist_to_promote.saturating_add(1);
                event.reserved_count = event.reserved_count.saturating_add(1);
                event.active_count = event.active_count.saturating_add(1);
            }
        } else if cancelled_waitlist_order == event.next_waitlist_to_promote {
            event.next_waitlist_to_promote = event.next_waitlist_to_promote.saturating_add(1);
        }

        event.status = if event.reserved_count >= event.seat_count {
            EventStatus::Full
        } else {
            EventStatus::Open
        };

        Ok(())
    }

    pub fn cancel_event(ctx: Context<CancelEvent>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!(
            matches!(event.status, EventStatus::Open | EventStatus::Full | EventStatus::InProgress),
            NoflakeError::EventCancellationClosed
        );

        event.status = EventStatus::Cancelled;
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
                    | EventStatus::Cancelled
            ),
            NoflakeError::EventSettlementClosed
        );
        require!(
            ctx.accounts.deposit_mint_account.key() == event.deposit_mint,
            NoflakeError::InvalidDepositMint
        );

        let event_key = event.key();
        let vault_bump_seed = [event.vault_authority_bump];
        let vault_signer_seeds = &[&[
            b"vault",
            event_key.as_ref(),
            &vault_bump_seed,
        ][..]];
        let event_cancelled = event.status == EventStatus::Cancelled;

        if !event_cancelled {
            require!(
                Clock::get()?.unix_timestamp >= event.cutoff_time,
                NoflakeError::EventSettlementTooEarly
            );
        }

        reservation.status = match reservation.status {
            ReservationStatus::CheckedIn => {
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.event_vault_token.to_account_info(),
                            mint: ctx.accounts.deposit_mint_account.to_account_info(),
                            to: ctx.accounts.attendee_deposit_token.to_account_info(),
                            authority: ctx.accounts.vault_authority.to_account_info(),
                        },
                        vault_signer_seeds,
                    ),
                    reservation.paid_amount,
                    ctx.accounts.deposit_mint_account.decimals,
                )?;
                ReservationStatus::Refunded
            }
            ReservationStatus::Waitlisted if event_cancelled => {
                transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.event_vault_token.to_account_info(),
                            mint: ctx.accounts.deposit_mint_account.to_account_info(),
                            to: ctx.accounts.attendee_deposit_token.to_account_info(),
                            authority: ctx.accounts.vault_authority.to_account_info(),
                        },
                        vault_signer_seeds,
                    ),
                    reservation.paid_amount,
                    ctx.accounts.deposit_mint_account.decimals,
                )?;
                ReservationStatus::Refunded
            }
            ReservationStatus::Reserved => match event.settlement_mode {
                SettlementMode::Strict if event_cancelled => {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.event_vault_token.to_account_info(),
                                mint: ctx.accounts.deposit_mint_account.to_account_info(),
                                to: ctx.accounts.attendee_deposit_token.to_account_info(),
                                authority: ctx.accounts.vault_authority.to_account_info(),
                            },
                            vault_signer_seeds,
                        ),
                        reservation.paid_amount,
                        ctx.accounts.deposit_mint_account.decimals,
                    )?;
                    ReservationStatus::Refunded
                }
                SettlementMode::Party | SettlementMode::Sponsor if event_cancelled => {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.event_vault_token.to_account_info(),
                                mint: ctx.accounts.deposit_mint_account.to_account_info(),
                                to: ctx.accounts.attendee_deposit_token.to_account_info(),
                                authority: ctx.accounts.vault_authority.to_account_info(),
                            },
                            vault_signer_seeds,
                        ),
                        reservation.paid_amount,
                        ctx.accounts.deposit_mint_account.decimals,
                    )?;
                    ReservationStatus::Refunded
                }
                SettlementMode::Strict => {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.event_vault_token.to_account_info(),
                                mint: ctx.accounts.deposit_mint_account.to_account_info(),
                                to: ctx.accounts.host_deposit_token.to_account_info(),
                                authority: ctx.accounts.vault_authority.to_account_info(),
                            },
                            vault_signer_seeds,
                        ),
                        reservation.paid_amount,
                        ctx.accounts.deposit_mint_account.decimals,
                    )?;
                    ReservationStatus::Forfeited
                }
                SettlementMode::Party | SettlementMode::Sponsor => ReservationStatus::NoShow,
            },
            ReservationStatus::Refunded
            | ReservationStatus::Forfeited
            | ReservationStatus::NoShow => {
                return err!(NoflakeError::ReservationAlreadySettled);
            }
            ReservationStatus::Cancelled => {
                return err!(NoflakeError::ReservationNotSettleable);
            }
            ReservationStatus::Waitlisted => {
                return err!(NoflakeError::ReservationNotSettleable);
            }
        };

        event.settled_count = event.settled_count.saturating_add(1);
        event.active_count = event.active_count.saturating_sub(1);
        event.status = if event_cancelled {
            EventStatus::Cancelled
        } else if event.active_count == 0 {
            EventStatus::Settling
        } else {
            EventStatus::InProgress
        };
        Ok(())
    }

    pub fn prepare_party_distribution(ctx: Context<PreparePartyDistribution>) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!(
            event.settlement_mode == SettlementMode::Party,
            NoflakeError::PartyDistributionUnavailable
        );
        require!(
            event.status == EventStatus::Settling && event.active_count == 0,
            NoflakeError::EventNotReadyToFinalize
        );
        require!(
            !event.party_bonus_prepared,
            NoflakeError::PartyDistributionAlreadyPrepared
        );

        let pool_amount = ctx.accounts.event_vault_token.amount;
        let checked_in_count = u64::from(event.checked_in_count);
        let bonus_per_attendee = if checked_in_count == 0 {
            0
        } else {
            pool_amount / checked_in_count
        };
        let remainder = if checked_in_count == 0 {
            pool_amount
        } else {
            pool_amount % checked_in_count
        };

        if remainder > 0 {
            let event_key = event.key();
            let vault_bump_seed = [event.vault_authority_bump];
            let vault_signer_seeds = &[&[
                b"vault",
                event_key.as_ref(),
                &vault_bump_seed,
            ][..]];

            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.event_vault_token.to_account_info(),
                        mint: ctx.accounts.deposit_mint_account.to_account_info(),
                        to: ctx.accounts.host_deposit_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                    vault_signer_seeds,
                ),
                remainder,
                ctx.accounts.deposit_mint_account.decimals,
            )?;
        }

        event.party_bonus_per_attendee = bonus_per_attendee;
        event.party_bonus_prepared = true;
        event.party_bonus_claimed_count = 0;
        Ok(())
    }

    pub fn claim_party_bonus(ctx: Context<ClaimPartyBonus>) -> Result<()> {
        let event = &mut ctx.accounts.event;
        let reservation = &mut ctx.accounts.reservation;

        require!(
            event.settlement_mode == SettlementMode::Party,
            NoflakeError::PartyDistributionUnavailable
        );
        require!(
            event.party_bonus_prepared,
            NoflakeError::PartyDistributionNotPrepared
        );
        require!(
            reservation.status == ReservationStatus::Refunded,
            NoflakeError::PartyBonusIneligible
        );
        require!(
            !reservation.party_bonus_claimed,
            NoflakeError::PartyBonusAlreadyClaimed
        );

        let event_key = event.key();
        let vault_bump_seed = [event.vault_authority_bump];
        let vault_signer_seeds = &[&[
            b"vault",
            event_key.as_ref(),
            &vault_bump_seed,
        ][..]];

        if event.party_bonus_per_attendee > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.event_vault_token.to_account_info(),
                        mint: ctx.accounts.deposit_mint_account.to_account_info(),
                        to: ctx.accounts.attendee_deposit_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                    vault_signer_seeds,
                ),
                event.party_bonus_per_attendee,
                ctx.accounts.deposit_mint_account.decimals,
            )?;
        }

        reservation.party_bonus_claimed = true;
        event.party_bonus_claimed_count = event.party_bonus_claimed_count.saturating_add(1);
        Ok(())
    }

    pub fn fund_sponsor_pool(ctx: Context<FundSponsorPool>, amount: u64) -> Result<()> {
        let event = &mut ctx.accounts.event;

        require!(
            event.settlement_mode == SettlementMode::Sponsor,
            NoflakeError::SponsorDistributionUnavailable
        );

        if let Some(existing_sponsor) = event.sponsor {
            require!(
                existing_sponsor == ctx.accounts.sponsor.key(),
                NoflakeError::SponsorMismatch
            );
        } else {
            event.sponsor = Some(ctx.accounts.sponsor.key());
        }

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.sponsor_source_token.to_account_info(),
                    mint: ctx.accounts.deposit_mint_account.to_account_info(),
                    to: ctx.accounts.sponsor_vault_token.to_account_info(),
                    authority: ctx.accounts.sponsor.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.deposit_mint_account.decimals,
        )?;

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
        require!(
            event.active_count == 0,
            NoflakeError::EventNotReadyToFinalize
        );

        if event.settlement_mode == SettlementMode::Party {
            require!(
                event.party_bonus_prepared,
                NoflakeError::EventNotReadyToFinalize
            );
            require!(
                event.party_bonus_claimed_count == event.checked_in_count,
                NoflakeError::EventNotReadyToFinalize
            );
        }

        event.status = EventStatus::Settled;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(title: String, venue: String, start_time: i64)]
pub struct InitializeEvent<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    #[account(
        init,
        payer = host,
        space = 8 + EventAccount::INIT_SPACE,
        seeds = [b"event", host.key().as_ref(), &start_time.to_le_bytes()],
        bump
    )]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    /// CHECK: PDA used as the canonical sponsor vault authority for this event.
    #[account(
        seeds = [b"sponsor-vault", event.key().as_ref()],
        bump
    )]
    pub sponsor_vault_authority: UncheckedAccount<'info>,
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = host,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReserveSeat<'info> {
    #[account(mut)]
    pub attendee: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump = event.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = attendee,
        associated_token::token_program = token_program,
    )]
    pub attendee_deposit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = attendee,
        space = 8 + ReservationAccount::INIT_SPACE,
        seeds = [b"reservation", event.key().as_ref(), attendee.key().as_ref()],
        bump
    )]
    pub reservation: Account<'info, ReservationAccount>,
    pub token_program: Interface<'info, TokenInterface>,
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
pub struct UndoCheckIn<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    #[account(mut, has_one = event)]
    pub reservation: Account<'info, ReservationAccount>,
}

#[derive(Accounts)]
pub struct CancelReservation<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump = event.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = reservation.attendee,
        associated_token::token_program = token_program,
    )]
    pub attendee_deposit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, has_one = event)]
    pub reservation: Account<'info, ReservationAccount>,
    #[account(mut)]
    pub promoted_reservation: Option<Account<'info, ReservationAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct SettleReservation<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump = event.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = reservation.attendee,
        associated_token::token_program = token_program,
    )]
    pub attendee_deposit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = host,
        associated_token::token_program = token_program,
    )]
    pub host_deposit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, has_one = event)]
    pub reservation: Account<'info, ReservationAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CancelEvent<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
}

#[derive(Accounts)]
pub struct PreparePartyDistribution<'info> {
    pub host: Signer<'info>,
    #[account(mut, has_one = host)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump = event.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = host,
        associated_token::token_program = token_program,
    )]
    pub host_deposit_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ClaimPartyBonus<'info> {
    pub attendee: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical vault authority for this event.
    #[account(
        seeds = [b"vault", event.key().as_ref()],
        bump = event.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = vault_authority,
        associated_token::token_program = token_program,
    )]
    pub event_vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = attendee,
        associated_token::token_program = token_program,
    )]
    pub attendee_deposit_token: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, has_one = event, has_one = attendee)]
    pub reservation: Account<'info, ReservationAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct FundSponsorPool<'info> {
    #[account(mut)]
    pub sponsor: Signer<'info>,
    #[account(mut)]
    pub event: Account<'info, EventAccount>,
    /// CHECK: PDA used as the canonical sponsor vault authority for this event.
    #[account(
        seeds = [b"sponsor-vault", event.key().as_ref()],
        bump = event.sponsor_vault_authority_bump
    )]
    pub sponsor_vault_authority: UncheckedAccount<'info>,
    #[account(
        mint::token_program = token_program,
        address = event.deposit_mint
    )]
    pub deposit_mint_account: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = sponsor,
        associated_token::token_program = token_program,
    )]
    pub sponsor_source_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = sponsor,
        associated_token::mint = deposit_mint_account,
        associated_token::authority = sponsor_vault_authority,
        associated_token::token_program = token_program,
    )]
    pub sponsor_vault_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
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
    pub deposit_mint: Pubkey,
    pub seat_count: u16,
    pub settlement_mode: SettlementMode,
    pub reserved_count: u16,
    pub active_count: u16,
    pub checked_in_count: u16,
    pub settled_count: u16,
    pub next_waitlist_order: u64,
    pub next_waitlist_to_promote: u64,
    pub status: EventStatus,
    pub party_bonus_per_attendee: u64,
    pub party_bonus_prepared: bool,
    pub party_bonus_claimed_count: u16,
    pub sponsor: Option<Pubkey>,
    pub sponsor_bonus_per_attendee: u64,
    pub sponsor_distribution_prepared: bool,
    pub sponsor_bonus_claimed_count: u16,
    pub sponsor_vault_authority_bump: u8,
    pub vault_authority_bump: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReservationAccount {
    pub event: Pubkey,
    pub attendee: Pubkey,
    pub status: ReservationStatus,
    pub paid_amount: u64,
    pub waitlist_order: u64,
    pub party_bonus_claimed: bool,
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
    #[msg("Reservation must be in checked-in state.")]
    ReservationNotCheckedIn,
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
    #[msg("Event settlement cannot start before the cutoff time.")]
    EventSettlementTooEarly,
    #[msg("Reservation cannot be cancelled from its current state.")]
    ReservationNotCancellable,
    #[msg("Reservation cancellation is closed after the cutoff time.")]
    ReservationCancellationClosed,
    #[msg("Provided waitlist promotion account is invalid.")]
    InvalidWaitlistPromotion,
    #[msg("Event cancellation is closed.")]
    EventCancellationClosed,
    #[msg("Event is not ready to finalize.")]
    EventNotReadyToFinalize,
    #[msg("Provided deposit mint does not match the event configuration.")]
    InvalidDepositMint,
    #[msg("Party distribution is not available for this event.")]
    PartyDistributionUnavailable,
    #[msg("Party distribution has already been prepared.")]
    PartyDistributionAlreadyPrepared,
    #[msg("Party distribution has not been prepared yet.")]
    PartyDistributionNotPrepared,
    #[msg("Reservation is not eligible for a party bonus.")]
    PartyBonusIneligible,
    #[msg("Party bonus has already been claimed.")]
    PartyBonusAlreadyClaimed,
    #[msg("Sponsor distribution is not available for this event.")]
    SponsorDistributionUnavailable,
    #[msg("Sponsor does not match the event sponsor.")]
    SponsorMismatch,
}
