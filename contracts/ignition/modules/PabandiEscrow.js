const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PabandiEscrowModule", (m) => {
  // Oracle Address (Pabandi Backend)
  // For local testing, we'll just use a mock address or the deployer's address
  const oracleAddress = m.getAccount(1); // Use the 2nd Hardhat account as oracle

  const escrow = m.contract("PabandiEscrow", [oracleAddress]);

  return { escrow };
});
