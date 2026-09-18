#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Pabandi Escrow — Anchor Deploy Script
# ─────────────────────────────────────────────
# Builds, deploys, and verifies the Solana Anchor escrow program.
#
# Usage:
#   ./deploy.sh [devnet|mainnet-beta]
#
# Environment variables:
#   SOLANA_RPC_URL  — RPC endpoint (defaults based on network)
#   SOLANA_WALLET  — Path to deployer keypair (defaults to ~/.config/solana/id.json)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRAM_NAME="pabandi_escrow"
PROGRAM_DIR="${SCRIPT_DIR}"
NETWORK="${1:-devnet}"
DEPLOYER_KEYPAIR="${SOLANA_WALLET:-$HOME/.config/solana/id.json}"
IDL_DIR="${PROGRAM_DIR}/../idl"

case "${NETWORK}" in
  devnet)
    RPC_URL="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
    ;;
  mainnet-beta)
    RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
    ;;
  *)
    echo "❌ Unknown network: ${NETWORK}. Use 'devnet' or 'mainnet-beta'."
    exit 1
    ;;
esac

echo "══════════════════════════════════════════════════════════════════════════════"
echo "  Pabandi Escrow — Anchor Deploy"
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  Network:      ${NETWORK}"
echo "  RPC URL:      ${RPC_URL}"
echo "  Deployer:     ${DEPLOYER_KEYPAIR}"
echo "  Program:      ${PROGRAM_NAME}"
echo "══════════════════════════════════════════════════════════════════════════════"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

echo ""
echo "🔍 Running pre-flight checks..."

# Check for Anchor CLI
if ! command -v anchor &> /dev/null; then
  echo "❌ Anchor CLI not found. Install with: avm install latest"
  exit 1
fi
echo "  ✅ Anchor CLI: $(anchor --version)"

# Check for Solana CLI
if ! command -v solana &> /dev/null; then
  echo "❌ Solana CLI not found. Install from https://docs.solana.com/cli"
  exit 1
fi
echo "  ✅ Solana CLI: $(solana --version)"

# Check deployer keypair exists
if [ ! -f "${DEPLOYER_KEYPAIR}" ]; then
  echo "❌ Deployer keypair not found at ${DEPLOYER_KEYPAIR}"
  echo "   Generate one with: solana-keygen new -o ${DEPLOYER_KEYPAIR}"
  exit 1
fi
echo "  ✅ Deployer keypair found"

# Check deployer balance
BALANCE=$(solana balance --url "${RPC_URL}" "${DEPLOYER_KEYPAIR}" 2>/dev/null | awk '{print $1}')
echo "  ℹ️  Deployer balance: ${BALANCE} SOL"

if (( $(echo "${BALANCE} < 0.5" | bc -l) )); then
  echo "⚠️  Low balance. Airdrop with: solana airdrop 2 --url ${RPC_URL}"
  if [ "${NETWORK}" != "devnet" ]; then
    echo "❌ Cannot proceed on mainnet with low balance."
    exit 1
  fi
fi

# ── Build ─────────────────────────────────────────────────────────────────────

echo ""
echo "🔨 Building Anchor program..."
cd "${PROGRAM_DIR}"

# Build with Anchor
anchor build --program-name "${PROGRAM_NAME}"

BUILD_STATUS=$?
if [ ${BUILD_STATUS} -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi
echo "  ✅ Build successful"

# Extract program ID from the keypair
PROGRAM_KEYPAIR="${PROGRAM_DIR}/target/deploy/${PROGRAM_NAME}-keypair.json"
if [ ! -f "${PROGRAM_KEYPAIR}" ]; then
  echo "❌ Program keypair not found at ${PROGRAM_KEYPAIR}"
  exit 1
fi

PROGRAM_ID=$(solana-keygen pubkey "${PROGRAM_KEYPAIR}")
echo "  ℹ️  Program ID: ${PROGRAM_ID}"

# ── Deploy ────────────────────────────────────────────────────────────────────

echo ""
echo "🚀 Deploying to ${NETWORK}..."

# Set Solana config to the target network
solana config set --url "${RPC_URL}" > /dev/null 2>&1
solana config set --keypair "${DEPLOYER_KEYPAIR}" > /dev/null 2>&1

# Deploy with Anchor
anchor deploy --program-name "${PROGRAM_NAME}" --provider.cluster "${NETWORK}"

DEPLOY_STATUS=$?
if [ ${DEPLOY_STATUS} -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo "  ✅ Deployment successful"

# ── Save Program ID ───────────────────────────────────────────────────────────

echo ""
echo "💾 Saving program ID..."

# Save to .env.contracts
ENV_FILE="${PROGRAM_DIR}/../../server/.env.contracts"
echo "PABANDI_ESCROW_PROGRAM_ID=${PROGRAM_ID}" > "${ENV_FILE}"
echo "  ✅ Saved to ${ENV_FILE}"

# Save to IDL directory
mkdir -p "${IDL_DIR}"
cp "${PROGRAM_DIR}/target/idl/${PROGRAM_NAME}.json" "${IDL_DIR}/pabandi_escrow.json"
echo "  ✅ IDL saved to ${IDL_DIR}/pabandi_escrow.json"

# ── Verify ────────────────────────────────────────────────────────────────────

echo ""
echo "✅ Verifying deployment..."

# Check program exists on-chain
PROGRAM_INFO=$(solana program show --url "${RPC_URL}" "${PROGRAM_ID}" 2>&1)
if echo "${PROGRAM_INFO}" | grep -q "Program Id:"; then
  echo "  ✅ Program verified on-chain"
  echo "  ℹ️  Program ID: ${PROGRAM_ID}"
else
  echo "  ⚠️  Could not verify program on-chain"
  echo "  ℹ️  Run: solana program show --url ${RPC_URL} ${PROGRAM_ID}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo "══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  Program ID:    ${PROGRAM_ID}"
echo "  Network:       ${NETWORK}"
echo "  RPC URL:       ${RPC_URL}"
echo "  IDL:           ${IDL_DIR}/pabandi_escrow.json"
echo ""
echo "  Next steps:"
echo "    1. Set PABANDI_ESCROW_PROGRAM_ID=${PROGRAM_ID} in your .env"
echo "    2. Run: npx prisma db push (to create SolanaEscrow table)"
echo "    3. Test with: anchor test --provider.cluster ${NETWORK}"
echo ""
echo "══════════════════════════════════════════════════════════════════════════════"
