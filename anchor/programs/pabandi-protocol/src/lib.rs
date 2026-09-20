//! Pabandi Protocol — On-Chain Program
//! ====================================
//! 
//! Single program handling:
//! 1. PAB Staking (with trust score boost)
//! 2. Escrow (multi-purpose)
//! 3. Agent Registry
//! 4. Trust Score Oracle
//! 
//! Composes with: Raydium (DEX), Kamino (lending), Jupiter (aggregator)

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("PabandiProtocol11111111111111111111111111111111");

#[program]
pub mod pabandi_protocol {
    use super::*;

    // ── STAKING ─────────────────────────────────────────

    /// Stake PAB tokens to earn trust score boost and yield
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        let clock = Clock::get()?;

        staking_account.owner = ctx.accounts.user.key();
        staking_account.amount = staking_account.amount.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        staking_account.staked_at = clock.unix_timestamp;
        staking_account.lock_period = 7 * 24 * 60 * 60; // 7 days
        staking_account.tier = calculate_tier(staking_account.amount);

        // Transfer PAB to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        emit!(Staked {
            user: ctx.accounts.user.key(),
            amount,
            tier: staking_account.tier,
        });

        Ok(())
    }

    /// Unstake PAB tokens (only after lock period)
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let staking_account = &mut ctx.accounts.staking_account;
        let clock = Clock::get()?;

        // Check lock period
        let unlock_time = staking_account.staked_at + staking_account.lock_period;
        require!(
            clock.unix_timestamp >= unlock_time,
            ErrorCode::StillLocked
        );

        let amount = staking_account.amount;

        // Transfer PAB back to user
        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        staking_account.amount = 0;
        staking_account.tier = Tier::Bronze;

        emit!(Unstaked {
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    // ── ESCROW ──────────────────────────────────────────

    /// Create escrow for any transaction type
    pub fn create_escrow(ctx: Context<EscrowCreate>, amount: u64, release_time: i64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.amount = amount;
        escrow.release_time = release_time;
        escrow.status = EscrowStatus::Active;
        escrow.created_at = clock.unix_timestamp;

        // Transfer tokens to escrow vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        emit!(EscrowCreated {
            escrow: escrow.key(),
            buyer: escrow.buyer,
            seller: escrow.seller,
            amount,
        });

        Ok(())
    }

    /// Release escrow to seller (buyer confirms receipt)
    pub fn release_escrow(ctx: Context<EscrowRelease>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        require!(escrow.status == EscrowStatus::Active, ErrorCode::NotActive);
        require!(
            clock.unix_timestamp >= escrow.release_time,
            ErrorCode::TooEarly
        );

        escrow.status = EscrowStatus::Released;

        // Transfer tokens to seller
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.escrow_vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, escrow.amount)?;

        emit!(EscrowReleased {
            escrow: escrow.key(),
            seller: escrow.seller,
            amount: escrow.amount,
        });

        Ok(())
    }

    /// Dispute escrow (triggers Jev arbitration)
    pub fn dispute_escrow(ctx: Context<EscrowDispute>, reason: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        require!(escrow.status == EscrowStatus::Active, ErrorCode::NotActive);

        escrow.status = EscrowStatus::Disputed;
        escrow.dispute_reason = reason;

        emit!(EscrowDisputed {
            escrow: escrow.key(),
            buyer: escrow.buyer,
            seller: escrow.seller,
        });

        Ok(())
    }

    // ── AGENT REGISTRY ──────────────────────────────────

    /// Register as an agent (service provider)
    pub fn register_agent(ctx: Context<AgentRegister>, stake_amount: u64) -> Result<()> {
        let agent = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        agent.owner = ctx.accounts.user.key();
        agent.stake = stake_amount;
        agent.reputation = 0;
        agent.tasks_completed = 0;
        agent.registered_at = clock.unix_timestamp;
        agent.is_active = true;

        // Stake PAB
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.agent_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, stake_amount)?;

        emit!(AgentRegistered {
            agent: ctx.accounts.user.key(),
            stake: stake_amount,
        });

        Ok(())
    }

    /// Complete a task (increases reputation)
    pub fn complete_task(ctx: Context<TaskComplete>, task_value: u64) -> Result<()> {
        let agent = &mut ctx.accounts.agent_account;

        agent.tasks_completed += 1;
        agent.reputation = agent.reputation.checked_add(1).ok_or(ErrorCode::Overflow)?;

        emit!(TaskCompleted {
            agent: agent.owner,
            task_value,
            new_reputation: agent.reputation,
        });

        Ok(())
    }

    // ── TRUST SCORE ORACLE ──────────────────────────────

    /// Update trust score (called by Pabandi backend)
    pub fn update_trust_score(ctx: Context<TrustUpdate>, new_score: u64) -> Result<()> {
        let trust_account = &mut ctx.accounts.trust_account;

        trust_account.user = ctx.accounts.user.key();
        trust_account.score = new_score;
        trust_account.last_updated = Clock::get()?.unix_timestamp;

        emit!(TrustScoreUpdated {
            user: ctx.accounts.user.key(),
            score: new_score,
        });

        Ok(())
    }
}

// ── ACCOUNTS ─────────────────────────────────────────────

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(init, payer = user, space = 8 + 100, seeds = [b"staking", user.key().as_ref()], bump)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"staking", user.key().as_ref()], bump)]
    pub staking_account: Account<'info, StakingAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EscrowCreate<'info> {
    #[account(init, payer = buyer, space = 8 + 200)]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: Seller pubkey
    pub seller: AccountInfo<'info>,
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EscrowRelease<'info> {
    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EscrowDispute<'info> {
    #[account(mut)]
    pub escrow: Account<'info, EscrowAccount>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
pub struct AgentRegister<'info> {
    #[account(init, payer = user, space = 8 + 100, seeds = [b"agent", user.key().as_ref()], bump)]
    pub agent_account: Account<'info, AgentAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub agent_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TaskComplete<'info> {
    #[account(mut, seeds = [b"agent", user.key().as_ref()], bump)]
    pub agent_account: Account<'info, AgentAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct TrustUpdate<'info> {
    #[account(init_if_needed, payer = authority, space = 8 + 50, seeds = [b"trust", user.key().as_ref()], bump)]
    pub trust_account: Account<'info, TrustAccount>,
    /// CHECK: User pubkey
    pub user: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ── STATE ────────────────────────────────────────────────

#[account]
pub struct StakingAccount {
    pub owner: Pubkey,
    pub amount: u64,
    pub staked_at: i64,
    pub lock_period: i64,
    pub tier: Tier,
}

#[account]
pub struct EscrowAccount {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub release_time: i64,
    pub status: EscrowStatus,
    pub created_at: i64,
    pub dispute_reason: String,
}

#[account]
pub struct AgentAccount {
    pub owner: Pubkey,
    pub stake: u64,
    pub reputation: u64,
    pub tasks_completed: u64,
    pub registered_at: i64,
    pub is_active: bool,
}

#[account]
pub struct TrustAccount {
    pub user: Pubkey,
    pub score: u64,
    pub last_updated: i64,
}

// ── ENUMS ────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Tier {
    Bronze,
    Silver,
    Gold,
    Platinum,
}

impl Default for Tier {
    fn default() -> Self {
        Tier::Bronze
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum EscrowStatus {
    Active,
    Released,
    Disputed,
    Refunded,
}

// ── EVENTS ───────────────────────────────────────────────

#[event]
pub struct Staked {
    pub user: Pubkey,
    pub amount: u64,
    pub tier: Tier,
}

#[event]
pub struct Unstaked {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCreated {
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowReleased {
    pub escrow: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowDisputed {
    pub escrow: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub stake: u64,
}

#[event]
pub struct TaskCompleted {
    pub agent: Pubkey,
    pub task_value: u64,
    pub new_reputation: u64,
}

#[event]
pub struct TrustScoreUpdated {
    pub user: Pubkey,
    pub score: u64,
}

// ── ERRORS ───────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Staking amount too low")]
    AmountTooLow,
    #[msg("Tokens still locked")]
    StillLocked,
    #[msg("Escrow not active")]
    NotActive,
    #[msg("Too early to release")]
    TooEarly,
    #[msg("Math overflow")]
    Overflow,
}

// ── HELPERS ──────────────────────────────────────────────

fn calculate_tier(amount: u64) -> Tier {
    if amount >= 2_000_000_000 { // 2000 PAB (6 decimals)
        Tier::Platinum
    } else if amount >= 500_000_000 { // 500 PAB
        Tier::Gold
    } else if amount >= 100_000_000 { // 100 PAB
        Tier::Silver
    } else {
        Tier::Bronze
    }
}
