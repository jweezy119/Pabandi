use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;
use spl_token::instruction as token_instruction;

declare_id!("11111111111111111111111111111111");

#[program]
pub mod pabandi_escrow {
    use super::*;

    /// Create a new escrow agreement.
    /// The buyer (payer) funds the escrow account rent-exemption lamports.
    /// The escrow PDA stores: buyer, seller, amount, mint, status, bump, reference.
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        amount: u64,
        reference: String,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        // Validate reference length (max 64 chars)
        require!(reference.len() <= 64, EscrowError::ReferenceTooLong);

        // Validate amount > 0
        require!(amount > 0, EscrowError::InvalidAmount);

        escrow.buyer = ctx.accounts.payer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.amount = amount;
        escrow.mint = ctx.accounts.usdc_mint.key();
        escrow.status = EscrowStatus::Created;
        escrow.bump = ctx.bumps.escrow;
        escrow.reference = reference;

        msg!(
            "Escrow created: buyer={}, seller={}, amount={}, reference={}",
            escrow.buyer,
            escrow.seller,
            escrow.amount,
            escrow.reference
        );

        Ok(())
    }

    /// Fund an existing escrow. The buyer transfers USDC from their token account
    /// to the escrow's PDA-owned token account.
    pub fn fund_escrow(ctx: Context<FundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        // Ensure escrow is in CREATED status
        require!(
            escrow.status == EscrowStatus::Created,
            EscrowError::InvalidStatusTransition
        );

        // Transfer USDC from buyer to escrow token account
        let transfer_ix = token_instruction::transfer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.buyer_token_account.key(),
            &ctx.accounts.escrow_token_account.key(),
            &ctx.accounts.buyer.key(),
            &[&ctx.accounts.buyer.key()],
            escrow.amount,
        )?;

        invoke(
            &transfer_ix,
            &[
                ctx.accounts.buyer_token_account.to_account_info(),
                ctx.accounts.escrow_token_account.to_account_info(),
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
        )?;

        escrow.status = EscrowStatus::Funded;

        msg!(
            "Escrow funded: buyer={}, amount={}, reference={}",
            escrow.buyer,
            escrow.amount,
            escrow.reference
        );

        Ok(())
    }

    /// Release funds from escrow to the seller. Only the buyer or platform authority
    /// can trigger this. The PDA signs the token transfer.
    pub fn release_funds(ctx: Context<ReleaseFunds>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        // Ensure escrow is in FUNDED status
        require!(
            escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatusTransition
        );

        // Derive the PDA signer seeds
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            escrow.reference.as_bytes(),
            &[escrow.bump],
        ];
        let signer_seeds = &[escrow_seeds];

        // Transfer USDC from escrow token account to seller
        let transfer_ix = token_instruction::transfer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.escrow_token_account.key(),
            &ctx.accounts.seller_token_account.key(),
            &ctx.accounts.escrow.key(),
            &[],
            escrow.amount,
        )?;

        invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.escrow_token_account.to_account_info(),
                ctx.accounts.seller_token_account.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        escrow.status = EscrowStatus::Released;

        msg!(
            "Escrow released to seller: seller={}, amount={}, reference={}",
            escrow.seller,
            escrow.amount,
            escrow.reference
        );

        Ok(())
    }

    /// Refund funds from escrow back to the buyer. Only the buyer or platform authority
    /// can trigger this.
    pub fn refund_funds(ctx: Context<RefundFunds>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        // Ensure escrow is in FUNDED status (can also allow DISPUTED for forced refund)
        require!(
            escrow.status == EscrowStatus::Funded || escrow.status == EscrowStatus::Disputed,
            EscrowError::InvalidStatusTransition
        );

        // Derive the PDA signer seeds
        let escrow_seeds: &[&[u8]] = &[
            b"escrow",
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            escrow.reference.as_bytes(),
            &[escrow.bump],
        ];
        let signer_seeds = &[escrow_seeds];

        // Transfer USDC from escrow token account back to buyer
        let transfer_ix = token_instruction::transfer(
            &ctx.accounts.token_program.key(),
            &ctx.accounts.escrow_token_account.key(),
            &ctx.accounts.buyer_token_account.key(),
            &ctx.accounts.escrow.key(),
            &[],
            escrow.amount,
        )?;

        invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.escrow_token_account.to_account_info(),
                ctx.accounts.buyer_token_account.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.token_program.to_account_info(),
            ],
            signer_seeds,
        )?;

        escrow.status = EscrowStatus::Refunded;

        msg!(
            "Escrow refunded to buyer: buyer={}, amount={}, reference={}",
            escrow.buyer,
            escrow.amount,
            escrow.reference
        );

        Ok(())
    }

    /// Raise a dispute. Either buyer or seller can call this.
    /// Status transitions: CREATED -> DISPUTED, FUNDED -> DISPUTED.
    pub fn raise_dispute(ctx: Context<RaiseDispute>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let disputant = ctx.accounts.disputant.key();

        // Only buyer or seller can dispute
        require!(
            disputant == escrow.buyer || disputant == escrow.seller,
            EscrowError::NotAuthorized
        );

        // Allow dispute from CREATED or FUNDED status
        require!(
            escrow.status == EscrowStatus::Created
                || escrow.status == EscrowStatus::Funded,
            EscrowError::InvalidStatusTransition
        );

        escrow.status = EscrowStatus::Disputed;

        msg!(
            "Dispute raised: disputant={}, reference={}",
            disputant,
            escrow.reference
        );

        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Accounts
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(amount: u64, reference: String)]
pub struct CreateEscrow<'info> {
    /// The buyer (payer) who creates the escrow
    #[account(mut)]
    pub payer: Signer<'info>,    /// The escrow PDA account. Seeds: ["escrow", buyer, seller, reference]
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 8 + 32 + 1 + 1 + 64 + 64,
        seeds = [b"escrow", payer.key().as_ref(), seller.key().as_ref(), reference.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,

    /// The seller (payee) — just needed for the PDA derivation
    pub seller: SystemAccount<'info>,

    /// The USDC mint address (for validation)
    pub usdc_mint: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    /// The buyer who funds the escrow
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The escrow PDA account
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// The buyer's USDC token account
    #[account(mut)]
    pub buyer_token_account: AccountInfo<'info>,

    /// The escrow's PDA-owned USDC token account
    #[account(mut)]
    pub escrow_token_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleaseFunds<'info> {
    /// The authority (buyer or platform) releasing the funds
    pub authority: Signer<'info>,

    /// The escrow PDA account
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// The seller's USDC token account
    #[account(mut)]
    pub seller_token_account: AccountInfo<'info>,

    /// The escrow's PDA-owned USDC token account
    #[account(mut)]
    pub escrow_token_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundFunds<'info> {
    /// The authority (buyer or platform) refunding the funds
    pub authority: Signer<'info>,

    /// The escrow PDA account
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,

    /// The buyer's USDC token account
    #[account(mut)]
    pub buyer_token_account: AccountInfo<'info>,

    /// The escrow's PDA-owned USDC token account
    #[account(mut)]
    pub escrow_token_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    /// The disputant (buyer or seller)
    pub disputant: Signer<'info>,

    /// The escrow PDA account
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
}

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

#[account]
pub struct Escrow {
    pub buyer: Pubkey,         // 32 bytes
    pub seller: Pubkey,        // 32 bytes
    pub amount: u64,           // 8 bytes
    pub mint: Pubkey,          // 32 bytes
    pub status: EscrowStatus,  // 1 byte
    pub bump: u8,              // 1 byte
    pub reference: String,     // 4 + 64 bytes (max 64 chars)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Created,
    Funded,
    Released,
    Refunded,
    Disputed,
}

impl EscrowStatus {
    pub fn to_string(&self) -> &str {
        match self {
            EscrowStatus::Created => "CREATED",
            EscrowStatus::Funded => "FUNDED",
            EscrowStatus::Released => "RELEASED",
            EscrowStatus::Refunded => "REFUNDED",
            EscrowStatus::Disputed => "DISPUTED",
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Reference ID must be 64 characters or fewer")]
    ReferenceTooLong,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Invalid status transition for this operation")]
    InvalidStatusTransition,
    #[msg("Only the buyer or seller can perform this action")]
    NotAuthorized,
}
