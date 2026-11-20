use anchor_lang::{
    prelude::{rent, Clock, Pubkey},
    solana_program::program_option::COption,
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::token::spl_token::state::{
    Account as SplTokenAccount, AccountState, Mint as SplMint,
};
use litesvm::LiteSVM;
use pabandi_escrow::{accounts, instruction, EscrowState, EscrowStatus, ProtocolConfig, ID};
use solana_account::Account as SolanaAccount;
use solana_keypair::Keypair;
use solana_message::Message;
use solana_program_pack::Pack;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SYSTEM_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0u8; 32]);
const RENT_SYSVAR_ID: Pubkey = rent::ID;
const TOKEN_PROGRAM_ID: Pubkey = anchor_spl::token::ID;
const TOKEN_2022_PROGRAM_ID: Pubkey = anchor_spl::token_2022::ID;

fn setup_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let so_path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/deploy/pabandi_escrow.so"
    );
    svm.add_program_from_file(ID, so_path)
        .expect("load pabandi_escrow.so");
    svm
}

fn create_mint_account(svm: &mut LiteSVM, mint: &Pubkey, token_program: Pubkey, decimals: u8) {
    let mut data = vec![0u8; SplMint::LEN];
    let mint_state = SplMint {
        mint_authority: COption::None,
        supply: 1_000_000_000_000,
        decimals,
        is_initialized: true,
        freeze_authority: COption::None,
    };
    SplMint::pack(mint_state, &mut data).unwrap();
    let lamports = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        *mint,
        SolanaAccount {
            lamports,
            data,
            owner: token_program,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn create_token_account(
    svm: &mut LiteSVM,
    account: &Pubkey,
    mint: &Pubkey,
    owner: &Pubkey,
    token_program: Pubkey,
    amount: u64,
) {
    let mut data = vec![0u8; SplTokenAccount::LEN];
    let state = SplTokenAccount {
        mint: *mint,
        owner: *owner,
        amount,
        delegate: COption::None,
        state: AccountState::Initialized,
        is_native: COption::None,
        delegated_amount: 0,
        close_authority: COption::None,
    };
    SplTokenAccount::pack(state, &mut data).unwrap();
    let lamports = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        *account,
        SolanaAccount {
            lamports,
            data,
            owner: token_program,
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

fn token_balance(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let acc = svm.get_account(account).expect("token account exists");
    SplTokenAccount::unpack(&acc.data[..SplTokenAccount::LEN])
        .unwrap()
        .amount
}

fn send_ix(
    svm: &mut LiteSVM,
    ix: anchor_lang::solana_program::instruction::Instruction,
    payer: &Keypair,
    signers: &[&Keypair],
) -> litesvm::types::TransactionResult {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new(&[ix], Some(&payer.pubkey()));
    let tx = Transaction::new(signers, msg, blockhash);
    svm.send_transaction(tx)
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"protocol_config"], &ID).0
}

fn escrow_pdas(reservation_id: &str, customer: &Pubkey) -> (Pubkey, Pubkey) {
    let state = Pubkey::find_program_address(
        &[b"escrow_state", reservation_id.as_bytes(), customer.as_ref()],
        &ID,
    )
    .0;
    let vault = Pubkey::find_program_address(
        &[b"escrow_vault", reservation_id.as_bytes(), customer.as_ref()],
        &ID,
    )
    .0;
    (state, vault)
}

fn init_protocol(svm: &mut LiteSVM, admin: &Keypair, oracle: &Keypair, treasury: &Pubkey) {
    let ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeConfig {
            admin: admin.pubkey(),
            protocol_config: config_pda(),
            system_program: SYSTEM_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeConfig {
            oracle: oracle.pubkey(),
            treasury: *treasury,
        }
        .data(),
    };
    send_ix(svm, ix, admin, &[admin]).expect("initialize_config succeeds");
}

#[test]
fn test_drpe_platinum_and_release_with_spl_token_usdc() {
    let mut svm = setup_svm();
    let admin = Keypair::new();
    let oracle = Keypair::new();
    let customer = Keypair::new();
    let business = Keypair::new();
    let treasury = Keypair::new();
    for kp in [&admin, &oracle, &customer, &business] {
        svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    }

    init_protocol(&mut svm, &admin, &oracle, &treasury.pubkey());

    // Verify ProtocolConfig stored correctly
    let cfg_acc = svm.get_account(&config_pda()).unwrap();
    let cfg = ProtocolConfig::try_deserialize(&mut cfg_acc.data.as_slice()).unwrap();
    assert_eq!(cfg.admin, admin.pubkey());
    assert_eq!(cfg.oracle, oracle.pubkey());
    assert_eq!(cfg.treasury, treasury.pubkey());
    assert!(!cfg.paused);

    let mint = Keypair::new().pubkey();
    create_mint_account(&mut svm, &mint, TOKEN_PROGRAM_ID, 6);

    let customer_ata = Keypair::new().pubkey();
    let business_ata = Keypair::new().pubkey();
    let treasury_ata = Keypair::new().pubkey();
    create_token_account(&mut svm, &customer_ata, &mint, &customer.pubkey(), TOKEN_PROGRAM_ID, 500_000_000); // 500 USDC
    create_token_account(&mut svm, &business_ata, &mint, &business.pubkey(), TOKEN_PROGRAM_ID, 0);
    create_token_account(&mut svm, &treasury_ata, &mint, &treasury.pubkey(), TOKEN_PROGRAM_ID, 0);

    let res_id = "res-platinum-001";
    let (escrow_state, vault) = escrow_pdas(res_id, &customer.pubkey());
    let deadline = svm.get_sysvar::<Clock>().unix_timestamp + 3600;

    // Booking total = 100 USDC (100_000_000). Trust Score = 98 (Platinum):
    // Deposit required = 10% = 10 USDC (10_000_000)
    // Fee = 0.30% of 100 = 0.30 USDC (300_000)
    let init_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeEscrow {
            customer: customer.pubkey(),
            business: business.pubkey(),
            mint,
            customer_token_account: customer_ata,
            protocol_config: config_pda(),
            escrow_state,
            vault_token_account: vault,
            oracle: oracle.pubkey(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
            rent: RENT_SYSVAR_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeEscrow {
            reservation_id: res_id.to_string(),
            trust_score: 98,
            total_amount: 100_000_000,
            deadline,
        }
        .data(),
    };
    send_ix(&mut svm, init_ix, &customer, &[&customer, &oracle]).expect("platinum init succeeds");

    assert_eq!(token_balance(&svm, &vault), 10_000_000);
    assert_eq!(token_balance(&svm, &customer_ata), 490_000_000);

    // Release escrow by authorized oracle
    let rel_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ReleaseEscrow {
            oracle_trigger: oracle.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            treasury_token_account: treasury_ata,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ReleaseEscrow {}.data(),
    };
    send_ix(&mut svm, rel_ix, &oracle, &[&oracle]).expect("release succeeds");

    assert_eq!(token_balance(&svm, &business_ata), 9_700_000); // 9.70 USDC
    assert_eq!(token_balance(&svm, &treasury_ata), 300_000); // 0.30 USDC
    // Vault account should be closed (rent reclaimed to customer)
    assert!(svm.get_account(&vault).map(|a| a.lamports).unwrap_or(0) == 0);

    let st_acc = svm.get_account(&escrow_state).unwrap();
    let st = EscrowState::try_deserialize(&mut st_acc.data.as_slice()).unwrap();
    assert_eq!(st.status, EscrowStatus::Released);
    assert!(st.is_resolved);
}

#[test]
fn test_token_2022_cash_gold_tier_and_security_rejections() {
    let mut svm = setup_svm();
    let admin = Keypair::new();
    let oracle = Keypair::new();
    let fake_oracle = Keypair::new();
    let attacker = Keypair::new();
    let customer = Keypair::new();
    let business = Keypair::new();
    let treasury = Keypair::new();
    for kp in [&admin, &oracle, &fake_oracle, &attacker, &customer, &business] {
        svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    }

    init_protocol(&mut svm, &admin, &oracle, &treasury.pubkey());

    // Token-2022 mint (Phantom CASH standard)
    let cash_mint = Keypair::new().pubkey();
    create_mint_account(&mut svm, &cash_mint, TOKEN_2022_PROGRAM_ID, 6);

    let customer_ata = Keypair::new().pubkey();
    let business_ata = Keypair::new().pubkey();
    let treasury_ata = Keypair::new().pubkey();
    let attacker_ata = Keypair::new().pubkey();
    create_token_account(&mut svm, &customer_ata, &cash_mint, &customer.pubkey(), TOKEN_2022_PROGRAM_ID, 200_000_000);
    create_token_account(&mut svm, &business_ata, &cash_mint, &business.pubkey(), TOKEN_2022_PROGRAM_ID, 0);
    create_token_account(&mut svm, &treasury_ata, &cash_mint, &treasury.pubkey(), TOKEN_2022_PROGRAM_ID, 0);
    create_token_account(&mut svm, &attacker_ata, &cash_mint, &attacker.pubkey(), TOKEN_2022_PROGRAM_ID, 0);

    let res_id = "res-cash-gold-001";
    let (escrow_state, vault) = escrow_pdas(res_id, &customer.pubkey());
    let deadline = svm.get_sysvar::<Clock>().unix_timestamp + 3600;

    // 1. Spoofed oracle MUST fail
    let spoof_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeEscrow {
            customer: customer.pubkey(),
            business: business.pubkey(),
            mint: cash_mint,
            customer_token_account: customer_ata,
            protocol_config: config_pda(),
            escrow_state,
            vault_token_account: vault,
            oracle: fake_oracle.pubkey(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_2022_PROGRAM_ID,
            rent: RENT_SYSVAR_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeEscrow {
            reservation_id: res_id.to_string(),
            trust_score: 100,
            total_amount: 100_000_000,
            deadline,
        }
        .data(),
    };
    assert!(
        send_ix(&mut svm, spoof_ix, &customer, &[&customer, &fake_oracle]).is_err(),
        "spoofed oracle must be rejected"
    );

    // 2. Real oracle initializes Gold tier (score 85 -> 25% deposit = 25 CASH, 0.80% fee = 0.80 CASH)
    let init_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeEscrow {
            customer: customer.pubkey(),
            business: business.pubkey(),
            mint: cash_mint,
            customer_token_account: customer_ata,
            protocol_config: config_pda(),
            escrow_state,
            vault_token_account: vault,
            oracle: oracle.pubkey(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_2022_PROGRAM_ID,
            rent: RENT_SYSVAR_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeEscrow {
            reservation_id: res_id.to_string(),
            trust_score: 85,
            total_amount: 100_000_000,
            deadline,
        }
        .data(),
    };
    send_ix(&mut svm, init_ix, &customer, &[&customer, &oracle]).expect("Token-2022 CASH init succeeds");
    assert_eq!(token_balance(&svm, &vault), 25_000_000);

    // 3. Unauthorized caller trying to release MUST fail
    let bad_rel_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ReleaseEscrow {
            oracle_trigger: attacker.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint: cash_mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            treasury_token_account: treasury_ata,
            token_program: TOKEN_2022_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ReleaseEscrow {}.data(),
    };
    assert!(
        send_ix(&mut svm, bad_rel_ix, &attacker, &[&attacker]).is_err(),
        "unauthorized release must fail"
    );

    // 4. Real oracle with attacker treasury token account MUST fail
    let bad_treasury_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ReleaseEscrow {
            oracle_trigger: oracle.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint: cash_mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            treasury_token_account: attacker_ata,
            token_program: TOKEN_2022_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ReleaseEscrow {}.data(),
    };
    assert!(
        send_ix(&mut svm, bad_treasury_ix, &oracle, &[&oracle]).is_err(),
        "attacker treasury account must fail"
    );

    // 5. Real oracle releases Token-2022 CASH to business + treasury
    let ok_rel_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ReleaseEscrow {
            oracle_trigger: oracle.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint: cash_mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            treasury_token_account: treasury_ata,
            token_program: TOKEN_2022_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ReleaseEscrow {}.data(),
    };
    send_ix(&mut svm, ok_rel_ix, &oracle, &[&oracle]).expect("Token-2022 CASH release succeeds");
    assert_eq!(token_balance(&svm, &business_ata), 24_200_000); // 24.20 CASH
    assert_eq!(token_balance(&svm, &treasury_ata), 800_000); // 0.80 CASH
}

#[test]
fn test_dispute_freeze_and_sulha_resolution_split() {
    let mut svm = setup_svm();
    let admin = Keypair::new();
    let oracle = Keypair::new();
    let customer = Keypair::new();
    let business = Keypair::new();
    let treasury = Keypair::new();
    for kp in [&admin, &oracle, &customer, &business] {
        svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    }

    init_protocol(&mut svm, &admin, &oracle, &treasury.pubkey());

    let mint = Keypair::new().pubkey();
    create_mint_account(&mut svm, &mint, TOKEN_PROGRAM_ID, 6);

    let customer_ata = Keypair::new().pubkey();
    let business_ata = Keypair::new().pubkey();
    let treasury_ata = Keypair::new().pubkey();
    create_token_account(&mut svm, &customer_ata, &mint, &customer.pubkey(), TOKEN_PROGRAM_ID, 100_000_000);
    create_token_account(&mut svm, &business_ata, &mint, &business.pubkey(), TOKEN_PROGRAM_ID, 0);
    create_token_account(&mut svm, &treasury_ata, &mint, &treasury.pubkey(), TOKEN_PROGRAM_ID, 0);

    let res_id = "res-dispute-001";
    let (escrow_state, vault) = escrow_pdas(res_id, &customer.pubkey());
    let deadline = svm.get_sysvar::<Clock>().unix_timestamp + 3600;

    // Standard tier (score 60): 100% deposit = 100 USDC, 1.50% fee = 1.50 USDC
    let init_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeEscrow {
            customer: customer.pubkey(),
            business: business.pubkey(),
            mint,
            customer_token_account: customer_ata,
            protocol_config: config_pda(),
            escrow_state,
            vault_token_account: vault,
            oracle: oracle.pubkey(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
            rent: RENT_SYSVAR_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeEscrow {
            reservation_id: res_id.to_string(),
            trust_score: 60,
            total_amount: 100_000_000,
            deadline,
        }
        .data(),
    };
    send_ix(&mut svm, init_ix, &customer, &[&customer, &oracle]).unwrap();

    // Customer files dispute
    let dispute_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::DisputeEscrow {
            caller: customer.pubkey(),
            escrow_state,
        }
        .to_account_metas(None),
        data: instruction::DisputeEscrow {
            reason_hash: [7u8; 32],
        }
        .data(),
    };
    send_ix(&mut svm, dispute_ix, &customer, &[&customer]).expect("dispute succeeds");

    // Normal release MUST be blocked while Disputed
    let blocked_rel_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ReleaseEscrow {
            oracle_trigger: oracle.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            treasury_token_account: treasury_ata,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ReleaseEscrow {}.data(),
    };
    assert!(
        send_ix(&mut svm, blocked_rel_ix, &oracle, &[&oracle]).is_err(),
        "release must fail when escrow is disputed"
    );

    // Sulha oracle resolves 60% to business (6000 bps), 40% refund to customer
    let resolve_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::ResolveDispute {
            oracle_trigger: oracle.pubkey(),
            protocol_config: config_pda(),
            customer: customer.pubkey(),
            mint,
            escrow_state,
            vault_token_account: vault,
            business_token_account: business_ata,
            customer_token_account: customer_ata,
            treasury_token_account: treasury_ata,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::ResolveDispute {
            business_bps: 6_000,
        }
        .data(),
    };
    send_ix(&mut svm, resolve_ix, &oracle, &[&oracle]).expect("resolve_dispute succeeds");

    // 60 USDC gross to business -> proportional fee = 60% of 1.50 = 0.90 USDC -> business gets 59.10 USDC, customer gets 40.00 USDC
    assert_eq!(token_balance(&svm, &business_ata), 59_100_000);
    assert_eq!(token_balance(&svm, &treasury_ata), 900_000);
    assert_eq!(token_balance(&svm, &customer_ata), 40_000_000);
}

#[test]
fn test_refund_enforces_deadline_and_returns_full_deposit() {
    let mut svm = setup_svm();
    let admin = Keypair::new();
    let oracle = Keypair::new();
    let customer = Keypair::new();
    let business = Keypair::new();
    let treasury = Keypair::new();
    for kp in [&admin, &oracle, &customer, &business] {
        svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
    }

    init_protocol(&mut svm, &admin, &oracle, &treasury.pubkey());

    let mint = Keypair::new().pubkey();
    create_mint_account(&mut svm, &mint, TOKEN_PROGRAM_ID, 6);

    let customer_ata = Keypair::new().pubkey();
    create_token_account(&mut svm, &customer_ata, &mint, &customer.pubkey(), TOKEN_PROGRAM_ID, 100_000_000);

    let res_id = "res-refund-001";
    let (escrow_state, vault) = escrow_pdas(res_id, &customer.pubkey());
    let now = svm.get_sysvar::<Clock>().unix_timestamp;
    let deadline = now + 1000;

    // New user (score 20): 100% deposit = 50 USDC
    let init_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::InitializeEscrow {
            customer: customer.pubkey(),
            business: business.pubkey(),
            mint,
            customer_token_account: customer_ata,
            protocol_config: config_pda(),
            escrow_state,
            vault_token_account: vault,
            oracle: oracle.pubkey(),
            system_program: SYSTEM_PROGRAM_ID,
            token_program: TOKEN_PROGRAM_ID,
            rent: RENT_SYSVAR_ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeEscrow {
            reservation_id: res_id.to_string(),
            trust_score: 20,
            total_amount: 50_000_000,
            deadline,
        }
        .data(),
    };
    send_ix(&mut svm, init_ix, &customer, &[&customer, &oracle]).unwrap();

    // Early refund before deadline MUST fail
    let refund_ix = anchor_lang::solana_program::instruction::Instruction {
        program_id: ID,
        accounts: accounts::RefundEscrow {
            customer: customer.pubkey(),
            mint,
            escrow_state,
            vault_token_account: vault,
            customer_token_account: customer_ata,
            token_program: TOKEN_PROGRAM_ID,
        }
        .to_account_metas(None),
        data: instruction::RefundEscrow {}.data(),
    };
    assert!(
        send_ix(&mut svm, refund_ix.clone(), &customer, &[&customer]).is_err(),
        "early refund before deadline must fail"
    );

    // Advance Clock sysvar past deadline and rotate blockhash for retry
    let mut clock = svm.get_sysvar::<Clock>();
    clock.unix_timestamp = deadline + 10;
    svm.set_sysvar(&clock);
    svm.expire_blockhash();

    // Refund now succeeds
    send_ix(&mut svm, refund_ix, &customer, &[&customer]).expect("post-deadline refund succeeds");
    assert_eq!(token_balance(&svm, &customer_ata), 100_000_000);
    assert!(svm.get_account(&vault).map(|a| a.lamports).unwrap_or(0) == 0);
}
