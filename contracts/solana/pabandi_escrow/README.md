# Pabandi Escrow Protocol (Solana)

Welcome to the open-source Solana smart contract repository for the **Pabandi Dynamic Risk-Priced Escrow (DRPE)** protocol.

This repository contains the core Anchor programs that power Pabandi's trust-driven escrow layer. By open-sourcing these contracts under the MIT License, we encourage developers, freelance platforms, and DeFi protocols to audit, integrate, and compose on top of our secure infrastructure.

## Architecture

The Pabandi Escrow protocol operates as a **Tier-1 Oracle Attested Smart Contract**.

Instead of purely static escrow conditions (where a saint and a scammer pay the same deposit), our smart contract dynamically adjusts deposit requirements based on a cryptographic signature provided by the Pabandi AI Trust Engine.

### Key Features
1. **Oracle-Signed Initialization**: The `initialize_escrow` instruction requires a valid Ed25519 signature from the authorized Pabandi Oracle. The payload contains the `trustScore`, which automatically dictates the deposit fraction (from 0% for Platinum users to 100% for unverified users).
2. **Platform Treasury & Fee Routing**: Built-in logic routes protocol fees seamlessly to the designated treasury vault.
3. **Mudarabah Yield Compatibility**: Escrowed funds are technically compatible with Sharia-compliant yield vaults while they remain locked, ensuring capital efficiency without compromising religious compliance.

## Integration & EaaS (Escrow-as-a-Service)

If you are a third-party platform (e.g., a freelance marketplace like Hyve, or a Web3 commerce site), you do *not* need to interact with this Rust code directly.

Instead, use our **[@pabandi/eaas-sdk](../../sdk/pabandi-eaas/README.md)**. The SDK handles generating the transaction payloads, fetching the required Oracle signatures, and deserializing the transactions for your users to sign via Phantom wallet.

## Building and Testing Locally

Ensure you have [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) and [Anchor](https://www.anchor-lang.com/docs/installation) installed.

```bash
# Build the program and generate the IDL
anchor build

# Run the test suite
anchor test
```

## Security & Audits

These contracts are provided as open-source public goods. If you discover a vulnerability, please contact security@pabandi.com before public disclosure.

## License

This project is licensed under the [MIT License](LICENSE).
