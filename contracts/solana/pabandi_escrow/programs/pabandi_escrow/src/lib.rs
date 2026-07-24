use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("6ebgdhyUV7zEHqRmpnaPguWQPYJu9Vq4dpFs79VduTjG");

#[program]
pub mod pabandi_escrow {
    use super::*;

    /// Initializes a new dynamic risk-priced escrow.
    /// The oracle signs the transaction and provides the customer's Trust Score (0-100).
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        reservation_id: String,
        trust_score: u8,
        total_amount: u64,
        deadline: i64,
    ) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;
        
        // Tier 1: Pabandi Signed Attestation Oracle
        // The backend oracle verifies the trust score off-chain and signs the Tx.

        // 2. Dynamic Risk-Pricing Logic (DRPE)
        // Defaults (Standard/New User)
        let mut deposit_required = total_amount; 
        let mut fee_bps = 250; // 2.5%

        if trust_score >= 95 {
            // Platinum: 10% deposit, 0.3% fee
            deposit_required = (total_amount * 10) / 100;
            fee_bps = 30;
        } else if trust_score >= 80 {
            // Gold: 25% deposit, 0.8% fee
            deposit_required = (total_amount * 25) / 100;
            fee_bps = 80;
        } else if trust_score >= 50 {
            // Standard: 100% deposit, 1.5% fee
            deposit_required = total_amount;
            fee_bps = 150;
        }

        let platform_fee_amount = (total_amount * fee_bps) / 10000;

        // 3. Transfer deposit to vault
        let transfer_ix = Transfer {
            from: ctx.accounts.customer_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.customer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            transfer_ix,
        );
        token::transfer(cpi_ctx, deposit_required)?;

        // 4. Update State
        escrow_state.reservation_id = reservation_id;
        escrow_state.customer = ctx.accounts.customer.key();
        escrow_state.business = ctx.accounts.business.key();
        escrow_state.mint = ctx.accounts.mint.key();
        
        escrow_state.total_amount = total_amount;
        escrow_state.deposit_amount = deposit_required;
        escrow_state.platform_fee_amount = platform_fee_amount;
        
        escrow_state.deadline = deadline;
        escrow_state.is_resolved = false;
        
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

    /// Releases funds to the business and platform treasury.
    /// In DRPE Tier 1, this can be triggered by a designated Oracle wallet
    /// representing Pabandi Backend (CHECKED_IN webhook).
    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;

        require!(!escrow_state.is_resolved, ErrorCode::AlreadyResolved);

        escrow_state.is_resolved = true;

        let total_in_vault = escrow_state.deposit_amount;
        let fee = escrow_state.platform_fee_amount;
        
        // In undercollateralized cases (Platinum), deposit_amount might be LESS than fee.
        // For simplicity in V1, we just take the fee up to the total in vault.
        let actual_fee = if fee > total_in_vault { total_in_vault } else { fee };
        let business_payout = total_in_vault.checked_sub(actual_fee).unwrap();

        let reservation_id_bytes = escrow_state.reservation_id.as_bytes();
        let customer_key = escrow_state.customer;
        
        let seeds = &[
            b"escrow_vault",
            reservation_id_bytes,
            customer_key.as_ref(),
            &[escrow_state.vault_bump],
        ];
        let signer = &[&seeds[..]];

        // Transfer to business
        if business_payout > 0 {
            let transfer_to_business = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.business_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_business = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_business,
                signer,
            );
            token::transfer(cpi_business, business_payout)?;
        }

        // Transfer fee to treasury
        if actual_fee > 0 {
            let transfer_to_treasury = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_treasury = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_treasury,
                signer,
            );
            token::transfer(cpi_treasury, actual_fee)?;
        }

        emit!(EscrowReleased {
            reservation_id: escrow_state.reservation_id.clone(),
            business_payout,
            fee_collected: actual_fee,
        });

        Ok(())
    }

    /// Refunds the customer if the deadline passes and business hasn't claimed/checked in.
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow_state = &mut ctx.accounts.escrow_state;
        require!(!escrow_state.is_resolved, ErrorCode::AlreadyResolved);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= escrow_state.deadline, ErrorCode::DeadlineNotReached);

        escrow_state.is_resolved = true;

        let refund_amount = escrow_state.deposit_amount;

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
            let transfer_to_customer = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.customer_token_account.to_account_info(),
                authority: ctx.accounts.vault_token_account.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                transfer_to_customer,
                signer,
            );
            token::transfer(cpi_ctx, refund_amount)?;
        }

        emit!(EscrowRefunded {
            reservation_id: escrow_state.reservation_id.clone(),
            refund_amount,
        });

        Ok(())
    }
}

// ─── Contexts ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(reservation_id: String)]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    /// CHECK: The business address to receive funds
    pub business: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = customer)]
    pub customer_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = customer,
        space = 8 + EscrowState::INIT_SPACE,
        seeds = [b"escrow_state", reservation_id.as_bytes(), customer.key().as_ref()],
        bump
    )]
    pub escrow_state: Account<'info, EscrowState>,

    #[account(
        init,
        payer = customer,
        token::mint = mint,
        token::authority = vault_token_account,
        seeds = [b"escrow_vault", reservation_id.as_bytes(), customer.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// CHECK: The Oracle that signs the initialization parameters
    #[account(mut)]
    pub oracle: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    /// Oracle trigger for Tier 1 - could be the Pabandi Backend Signer
    #[account(mut)]
    pub oracle_trigger: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
    )]
    pub escrow_state: Account<'info, EscrowState>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.vault_bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = escrow_state.mint, associated_token::authority = escrow_state.business)]
    pub business_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury account for fees
    #[account(mut)]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut)]
    pub customer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow_state", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.state_bump,
        has_one = customer
    )]
    pub escrow_state: Account<'info, EscrowState>,

    #[account(
        mut,
        seeds = [b"escrow_vault", escrow_state.reservation_id.as_bytes(), escrow_state.customer.as_ref()],
        bump = escrow_state.vault_bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, associated_token::mint = escrow_state.mint, associated_token::authority = customer)]
    pub customer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── State ──────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct EscrowState {
    #[max_len(64)]
    pub reservation_id: String,
    pub customer: Pubkey,
    pub business: Pubkey,
    pub mint: Pubkey,
    
    pub total_amount: u64,
    pub deposit_amount: u64,
    pub platform_fee_amount: u64,
    
    pub deadline: i64,
    pub is_resolved: bool,
    
    pub state_bump: u8,
    pub vault_bump: u8,
}

// ─── Errors & Events ────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Escrow is already resolved.")]
    AlreadyResolved,
    #[msg("Deadline has not been reached yet.")]
    DeadlineNotReached,
    #[msg("Invalid Switchboard Oracle Feed.")]
    InvalidOracleFeed,
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
pub struct EscrowRefunded {
    pub reservation_id: String,
    pub refund_amount: u64,
}
