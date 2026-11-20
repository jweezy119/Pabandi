use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc");

pub const MAX_RESERVATION_ID_LEN: usize = 64;
pub const BPS_DENOMINATOR: u128 = 10_000;

/// Compute Dynamic Risk-Pricing Engine (DRPE) deposit & platform fee using overflow-safe u128 math.
///
/// Tiers:
/// - Platinum (95..=100): 10% deposit, 0.30% (30 bps) fee
/// - Gold     (80..=94):  25% deposit, 0.80% (80 bps) fee
/// - Standard (50..=79): 100% deposit, 1.50% (150 bps) fee
/// - New/Risk ( 0..=49): 100% deposit, 2.50% (250 bps) fee
pub fn calculate_drpe_terms(trust_score: u8, total_amount: u64) -> Result<(u64, u64, u16)> {
    require!(trust_score <= 100, ErrorCode::InvalidTrustScore);
    require!(total_amount > 0, ErrorCode::InvalidAmount);

    let (deposit_bps, fee_bps): (u128, u16) = if trust_score >= 95 {
        (1_000, 30)
    } else if trust_score >= 80 {
        (2_500, 80)
    } else if trust_score >= 50 {
        (10_000, 150)
    } else {
        (10_000, 250)
    };

    let total_u128 = u128::from(total_amount);
    let deposit_u128 = total_u128
        .checked_mul(deposit_bps)
        .ok_or(ErrorCode::MathOverflow)?
        / BPS_DENOMINATOR;
    let fee_u128 = total_u128
        .checked_mul(u128::from(fee_bps))
        .ok_or(ErrorCode::MathOverflow)?
        / BPS_DENOMINATOR;

    let deposit_required = u64::try_from(deposit_u128).map_err(|_| ErrorCode::MathOverflow)?;
    let platform_fee_amount = u64::try_from(fee_u128).map_err(|_| ErrorCode::MathOverflow)?;

    require!(deposit_required > 0, ErrorCode::InvalidAmount);
    Ok((deposit_required, platform_fee_amount, fee_bps))
}

#[program]
pub mod pabandi_escrow {
    use super::*;

    /// Initializes the singleton ProtocolConfig PDA.
    /// Transfer `admin` to a Squads Multisig for production governance.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        oracle: Pubkey,
        treasury: Pubkey,
    ) -> Result<()> {
        require!(oracle != Pubkey::default(), ErrorCode::InvalidPubkey);
        require!(treasury != Pubkey::default(), ErrorCode::InvalidPubkey);

        let config = &mut ctx.accounts.protocol_config;
        config.admin = ctx.accounts.admin.key();
        config.oracle = oracle;
        config.treasury = treasury;
        config.paused = false;
        config.bump = ctx.bumps.protocol_config;

        emit!(ProtocolConfigUpdated {
            admin: config.admin,
            oracle: config.oracle,
            treasury: config.treasury,
            paused: config.paused,
        });

        Ok(())
    }

    /// Updates protocol governance parameters (admin-only; intended for Squads Multisig).
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin: Option<Pubkey>,
        new_oracle: Option<Pubkey>,
        new_treasury: Option<Pubkey>,
        paused: Option<bool>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;

        if let Some(admin) = new_admin {
            require!(admin != Pubkey::default(), ErrorCode::InvalidPubkey);
            config.admin = admin;
        }
        if let Some(oracle) = new_oracle {
            require!(oracle != Pubkey::default(), ErrorCode::InvalidPubkey);
            config.oracle = oracle;
        }
        if let Some(treasury) = new_treasury {
            require!(treasury != Pubkey::default(), ErrorCode::InvalidPubkey);
            config.treasury = treasury;
        }
        if let Some(is_paused) = paused {
            config.paused = is_paused;
        }

        emit!(ProtocolConfigUpdated {
            admin: config.admin,
            oracle: config.oracle,
            treasury: config.treasury,
            paused: config.paused,
        });

        Ok(())
    }

    /// Initializes a new dynamic risk-priced escrow supporting both SPL Token (USDC)
    /// and Token-2022 (Phantom CASH) via TokenInterface + transfer_checked.
    /// The authorized ProtocolConfig oracle co-signs to attest the customer's Trust Score (0-100).
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        reservation_id: String,
        trust_score: u8,
        total_amount: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.protocol_config.paused, ErrorCode::ProtocolPaused);
        require!(
            !reservation_id.is_empty() && reservation_id.len() <= MAX_RESERVATION_ID_LEN,
            ErrorCode::InvalidReservationId
        );
        require!(
            ctx.accounts.business.key() != Pubkey::default()
                && ctx.accounts.business.key() != ctx.accounts.customer.key(),
            ErrorCode::InvalidParty
        );

        let clock = Clock::get()?;
        require!(deadline > clock.unix_timestamp, ErrorCode::InvalidDeadline);

        let (deposit_required, platform_fee_amount, _fee_bps) =
            calculate_drpe_terms(trust_score, total_amount)?;

        // Transfer risk-priced deposit into PDA vault (SPL Token & Token-2022 compatible)
        let transfer_ix = TransferChecked {
            from: ctx.accounts.customer_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.customer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), transfer_ix);
        token_interface::transfer_checked(cpi_ctx, deposit_required, ctx.accounts.mint.decimals)?;

        // Persist escrow state
        let escrow_state = &mut ctx.accounts.escrow_state;
        escrow_state.reservation_id = reservation_id;
        escrow_state.customer = ctx.accounts.customer.key();
        escrow_state.business = ctx.accounts.business.key();
        escrow_state.mint = ctx.accounts.mint.key();
        escrow_state.trust_score = trust_score;
        escrow_state.total_amount = total_amount;
        escrow_state.deposit_amount = deposit_required;
        escrow_state.platform_fee_amount = platform_fee_amount;
        escrow_state.deadline = deadline;
        escrow_state.status = EscrowStatus::Active;
        escrow_state.is_resolved = false;
        escrow_state.dispute_reason_hash = [0u8; 32];
        escrow_state.state_bump = ctx.bumps.escrow_state;
        escrow_state.vault_bump = ctx.bumps.vault_token_account;

        emit!(EscrowInitialized {
            reservation_id: escrow_state.reservation_id.clone(),
            customer: escrow_state.customer,
            business: escrow_state.business,
            trust_score,
            deposit_amount: deposit_required,
            fee_amount: platform_fee_amount,
        });

        Ok(())
    }

    /// Releases funds to the verified business and ProtocolConfig treasury.
    /// Only callable by the authorized ProtocolConfig oracle on an Active escrow.
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;

        require!(
            !escrow_state.is_resolved && escrow_state.status == EscrowStatus::Active,
            ErrorCode::NotActive
        );

        escrow_state.status = EscrowStatus::Released;
        escrow_state.is_resolved = true;

        let total_in_vault = escrow_state.deposit_amount;
        let actual_fee = escrow_state.platform_fee_amount.min(total_in_vault);
        let business_payout = total_in_vault
            .checked_sub(actual_fee)
            .ok_or(ErrorCode::MathOverflow)?;
        let decimals = ctx.accounts.mint.decimals;

        let reservation_id_bytes = escrow_state.reservation_id.as_bytes();
        let customer_key = escrow_state.customer;
        let seeds = &[
            b"escrow_vault",
            reservation_id_bytes,
            customer_key.as_ref(),
            &[escrow_state.vault_bump],
        ];
        let signer = &[&seeds[..]];

        if business_payout > 0 {
            let transfer_to_business = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.business_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_business = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_business,
                signer,
            );
            token_interface::transfer_checked(cpi_business, business_payout, decimals)?;
        }

        if actual_fee > 0 {
            let transfer_to_treasury = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_treasury = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_treasury,
                signer,
            );
            token_interface::transfer_checked(cpi_treasury, actual_fee, decimals)?;
        }

        // Reclaim vault token account rent back to the customer who funded it
        let close_vault = CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.customer.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        };
        let cpi_close = CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            close_vault,
            signer,
        );
        token_interface::close_account(cpi_close)?;

        emit!(EscrowReleased {
            reservation_id: escrow_state.reservation_id.clone(),
            business_payout,
            fee_collected: actual_fee,
        });

        Ok(())
    }

    /// Freezes an Active escrow for Sulha dispute evidence arbitration.
    /// Callable only by the customer or the business.
    pub fn dispute_escrow(ctx: Context<DisputeEscrow>, reason_hash: [u8; 32]) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;

        require!(
            !escrow_state.is_resolved && escrow_state.status == EscrowStatus::Active,
            ErrorCode::NotActive
        );
        let caller = ctx.accounts.caller.key();
        require!(
            caller == escrow_state.customer || caller == escrow_state.business,
            ErrorCode::UnauthorizedParty
        );

        escrow_state.status = EscrowStatus::Disputed;
        escrow_state.dispute_reason_hash = reason_hash;

        emit!(EscrowDisputed {
            reservation_id: escrow_state.reservation_id.clone(),
            caller,
            reason_hash,
        });

        Ok(())
    }

    /// Resolves a Disputed escrow by splitting the locked deposit according to `business_bps` (0..=10_000).
    /// Callable only by the authorized ProtocolConfig oracle.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, business_bps: u16) -> Result<()> {
        require!(u128::from(business_bps) <= BPS_DENOMINATOR, ErrorCode::InvalidSplit);

        let escrow_state = &mut ctx.accounts.escrow_state;
        require!(
            !escrow_state.is_resolved && escrow_state.status == EscrowStatus::Disputed,
            ErrorCode::NotDisputed
        );

        escrow_state.status = EscrowStatus::Resolved;
        escrow_state.is_resolved = true;

        let total_in_vault = escrow_state.deposit_amount;
        let business_gross = u64::try_from(
            u128::from(total_in_vault)
                .checked_mul(u128::from(business_bps))
                .ok_or(ErrorCode::MathOverflow)?
                / BPS_DENOMINATOR,
        )
        .map_err(|_| ErrorCode::MathOverflow)?;
        let customer_refund = total_in_vault
            .checked_sub(business_gross)
            .ok_or(ErrorCode::MathOverflow)?;

        let proportional_fee = u64::try_from(
            u128::from(escrow_state.platform_fee_amount)
                .checked_mul(u128::from(business_bps))
                .ok_or(ErrorCode::MathOverflow)?
                / BPS_DENOMINATOR,
        )
        .map_err(|_| ErrorCode::MathOverflow)?;
        let actual_fee = proportional_fee.min(business_gross);
        let business_payout = business_gross
            .checked_sub(actual_fee)
            .ok_or(ErrorCode::MathOverflow)?;
        let decimals = ctx.accounts.mint.decimals;

        let reservation_id_bytes = escrow_state.reservation_id.as_bytes();
        let customer_key = escrow_state.customer;
        let seeds = &[
            b"escrow_vault",
            reservation_id_bytes,
            customer_key.as_ref(),
            &[escrow_state.vault_bump],
        ];
        let signer = &[&seeds[..]];

        if business_payout > 0 {
            let ix = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.business_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            token_interface::transfer_checked(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), ix, signer),
                business_payout,
                decimals,
            )?;
        }

        if actual_fee > 0 {
            let ix = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            token_interface::transfer_checked(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), ix, signer),
                actual_fee,
                decimals,
            )?;
        }

        if customer_refund > 0 {
            let ix = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.customer_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            token_interface::transfer_checked(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), ix, signer),
                customer_refund,
                decimals,
            )?;
        }

        let close_vault = CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.customer.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        };
        token_interface::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            close_vault,
            signer,
        ))?;

        emit!(DisputeResolved {
            reservation_id: escrow_state.reservation_id.clone(),
            business_bps,
            business_payout,
            customer_refund,
            fee_collected: actual_fee,
        });

        Ok(())
    }

    /// Refunds the customer if the deadline passes and the escrow is still Active (not Released or Disputed).
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;
        require!(
            !escrow_state.is_resolved && escrow_state.status == EscrowStatus::Active,
            ErrorCode::NotActive
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= escrow_state.deadline,
            ErrorCode::DeadlineNotReached
        );

        escrow_state.status = EscrowStatus::Refunded;
        escrow_state.is_resolved = true;

        let refund_amount = escrow_state.deposit_amount;
        let decimals = ctx.accounts.mint.decimals;

        let reservation_id_bytes = escrow_state.reservation_id.as_bytes();
        let customer_key = escrow_state.customer;
        let seeds = &[
            b"escrow_vault",
            reservation_id_bytes,
            customer_key.as_ref(),
            &[escrow_state.vault_bump],
        ];
        let signer = &[&seeds[..]];

        if refund_amount > 0 {
            let transfer_to_customer = TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.customer_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_customer,
                signer,
            );
            token_interface::transfer_checked(cpi_ctx, refund_amount, decimals)?;
        }

        let close_vault = CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.customer.to_account_info(),
            authority: ctx.accounts.vault_token_account.to_account_info(),
        };
        token_interface::close_account(CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            close_vault,
            signer,
        ))?;

        emit!(EscrowRefunded {
            reservation_id: escrow_state.reservation_id.clone(),
            refund_amount,
        });

        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol_config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"protocol_config"],
        bump = protocol_config.bump,
        has_one = admin @ ErrorCode::UnauthorizedAdmin
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
}

#[derive(Accounts)]
#[instruction(reservation_id: String)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: Verified non-default and distinct from customer in handler; receives payouts via token account authority check.
    pub business: UncheckedAccount<'info>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = customer,
        token::token_program = token_program
    )]
    pub customer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    #[account(
        init,
        payer = customer,
        space = 8 + EscrowState::INIT_SPACE,
        seeds = [b"escrow_state", reservation_id.as_bytes(), customer.key().as_ref()],
        bump
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    #[account(
        init,
        payer = customer,
        token::mint = mint,
        token::authority = vault_token_account,
        token::token_program = token_program,
        seeds = [b"escrow_vault", reservation_id.as_bytes(), customer.key().as_ref()],
        bump
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        constraint = oracle.key() == protocol_config.oracle @ ErrorCode::UnauthorizedOracle
    )]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(
        constraint = oracle_trigger.key() == protocol_config.oracle @ ErrorCode::UnauthorizedOracle
    )]
    pub oracle_trigger: Signer<'info>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    /// CHECK: Verified against `escrow_state.customer` to receive closed vault rent lamports.
    #[account(mut, address = escrow_state.customer)]
    pub customer: UncheckedAccount<'info>,

    #[account(
        address = escrow_state.mint,
        mint::token_program = token_program
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.vault_bump,
        token::mint = mint,
        token::authority = vault_token_account,
        token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state.business,
        token::token_program = token_program
    )]
    pub business_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = protocol_config.treasury,
        token::token_program = token_program
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct DisputeEscrow<'info> {
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        constraint = oracle_trigger.key() == protocol_config.oracle @ ErrorCode::UnauthorizedOracle
    )]
    pub oracle_trigger: Signer<'info>,

    #[account(
        seeds = [b"protocol_config"],
        bump = protocol_config.bump
    )]
    pub protocol_config: Box<Account<'info, ProtocolConfig>>,

    /// CHECK: Verified against `escrow_state.customer` to receive closed vault rent lamports.
    #[account(mut, address = escrow_state.customer)]
    pub customer: UncheckedAccount<'info>,

    #[account(
        address = escrow_state.mint,
        mint::token_program = token_program
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.vault_bump,
        token::mint = mint,
        token::authority = vault_token_account,
        token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state.business,
        token::token_program = token_program
    )]
    pub business_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_state.customer,
        token::token_program = token_program
    )]
    pub customer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = protocol_config.treasury,
        token::token_program = token_program
    )]
    pub treasury_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    #[account(
        address = escrow_state.mint,
        mint::token_program = token_program
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
        has_one = customer
    )]
    pub escrow_state: Box<Account<'info, EscrowState>>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.vault_bump,
        token::mint = mint,
        token::authority = vault_token_account,
        token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = customer,
        token::token_program = token_program
    )]
    pub customer_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

// ─── State ──────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub treasury: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum EscrowStatus {
    Active,
    Released,
    Disputed,
    Resolved,
    Refunded,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowState {
    #[max_len(64)]
    pub reservation_id: String,
    pub customer: Pubkey,
    pub business: Pubkey,
    pub mint: Pubkey,

    pub trust_score: u8,
    pub total_amount: u64,
    pub deposit_amount: u64,
    pub platform_fee_amount: u64,

    pub deadline: i64,
    pub status: EscrowStatus,
    pub is_resolved: bool,
    pub dispute_reason_hash: [u8; 32],

    pub state_bump: u8,
    pub vault_bump: u8,
}

// ─── Errors & Events ────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Escrow is already resolved.")]
    AlreadyResolved,
    #[msg("Escrow is not active.")]
    NotActive,
    #[msg("Escrow is not in disputed state.")]
    NotDisputed,
    #[msg("Deadline has not been reached yet.")]
    DeadlineNotReached,
    #[msg("Deadline must be in the future.")]
    InvalidDeadline,
    #[msg("Trust score must be between 0 and 100.")]
    InvalidTrustScore,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Reservation ID must be 1 to 64 bytes.")]
    InvalidReservationId,
    #[msg("Invalid party address.")]
    InvalidParty,
    #[msg("Invalid public key.")]
    InvalidPubkey,
    #[msg("Caller is not the authorized protocol admin.")]
    UnauthorizedAdmin,
    #[msg("Caller is not the authorized protocol oracle.")]
    UnauthorizedOracle,
    #[msg("Caller is not a party to this escrow.")]
    UnauthorizedParty,
    #[msg("Treasury token account does not belong to the configured protocol treasury.")]
    InvalidTreasury,
    #[msg("Dispute split basis points must be <= 10000.")]
    InvalidSplit,
    #[msg("Protocol is currently paused.")]
    ProtocolPaused,
    #[msg("Arithmetic overflow.")]
    MathOverflow,
}

#[event]
pub struct ProtocolConfigUpdated {
    pub admin: Pubkey,
    pub oracle: Pubkey,
    pub treasury: Pubkey,
    pub paused: bool,
}

#[event]
pub struct EscrowInitialized {
    pub reservation_id: String,
    pub customer: Pubkey,
    pub business: Pubkey,
    pub trust_score: u8,
    pub deposit_amount: u64,
    pub fee_amount: u64,
}

#[event]
pub struct EscrowReleased {
    pub reservation_id: String,
    pub business_payout: u64,
    pub fee_collected: u64,
}

#[event]
pub struct EscrowDisputed {
    pub reservation_id: String,
    pub caller: Pubkey,
    pub reason_hash: [u8; 32],
}

#[event]
pub struct DisputeResolved {
    pub reservation_id: String,
    pub business_bps: u16,
    pub business_payout: u64,
    pub customer_refund: u64,
    pub fee_collected: u64,
}

#[event]
pub struct EscrowRefunded {
    pub reservation_id: String,
    pub refund_amount: u64,
}
