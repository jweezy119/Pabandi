import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../server/.env" });

// ── Key / RPC resolution ────────────────────────────────────────────────────
// DEPLOYER_PRIVATE_KEY should be set in server/.env (or contracts/.env)
const DEPLOYER_KEY: string =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001"; // safe placeholder

const BSC_SCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // ── Local development ──────────────────────────────────────────────────
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── BSC Testnet (Chapel) ───────────────────────────────────────────────
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [DEPLOYER_KEY],
      gasPrice: 10_000_000_000, // 10 gwei
    },

    // ── BSC Mainnet ────────────────────────────────────────────────────────
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [DEPLOYER_KEY],
      gasPrice: 3_000_000_000, // 3 gwei
    },
  },

  etherscan: {
    apiKey: {
      bscTestnet: BSC_SCAN_API_KEY,
      bsc:        BSC_SCAN_API_KEY,
    },
    customChains: [
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL:    "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com",
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    token: "BNB",
  },

  paths: {
    sources:   "./",         // Solidity files are at contracts root
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },

  typechain: {
    outDir: "./typechain-types",
    target: "ethers-v6",
  },
};

export default config;
