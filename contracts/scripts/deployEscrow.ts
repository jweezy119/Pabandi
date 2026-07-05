import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // Deploying PabandiEscrow
  const PabandiEscrow = await ethers.getContractFactory("PabandiEscrow");
  const escrow = await PabandiEscrow.deploy(deployer.address); // Oracle is the deployer

  await escrow.waitForDeployment();

  console.log("PabandiEscrow deployed to:", await escrow.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
