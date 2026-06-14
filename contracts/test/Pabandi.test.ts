import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { PABToken, PabandiEscrow, PabandiSoulbound } from "../typechain-types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

async function deployAllFixture() {
  const [owner, minter, relayer, treasury, customer, business, user2] =
    await ethers.getSigners();

  const PABTokenFactory = await ethers.getContractFactory("PABToken");
  const pabToken = (await PABTokenFactory.deploy(owner.address, minter.address)) as PABToken;

  const EscrowFactory = await ethers.getContractFactory("PabandiEscrow");
  const escrow = (await EscrowFactory.deploy(
    owner.address, relayer.address, treasury.address
  )) as PabandiEscrow;

  const SoulboundFactory = await ethers.getContractFactory("PabandiSoulbound");
  const soulbound = (await SoulboundFactory.deploy(owner.address, minter.address)) as PabandiSoulbound;

  return { pabToken, escrow, soulbound, owner, minter, relayer, treasury, customer, business, user2 };
}

// ── PABToken Tests ────────────────────────────────────────────────────────────

describe("PABToken", () => {
  it("has correct name, symbol, cap", async () => {
    const { pabToken } = await loadFixture(deployAllFixture);
    expect(await pabToken.name()).to.equal("Pabandi Reliability Token");
    expect(await pabToken.symbol()).to.equal("PAB");
    expect(await pabToken.cap()).to.equal(ethers.parseEther("1000000000"));
  });

  it("minter can mint rewards", async () => {
    const { pabToken, minter, customer } = await loadFixture(deployAllFixture);
    const amount = ethers.parseEther("50");
    const reservationId = ethers.keccak256(ethers.toUtf8Bytes("res_001"));

    await pabToken.connect(minter).mintReward(customer.address, amount, reservationId, "CHECK_IN");
    expect(await pabToken.balanceOf(customer.address)).to.equal(amount);
  });

  it("non-minter cannot mint", async () => {
    const { pabToken, customer } = await loadFixture(deployAllFixture);
    await expect(
      pabToken.connect(customer).mintReward(
        customer.address,
        ethers.parseEther("50"),
        ethers.keccak256(ethers.toUtf8Bytes("res_001")),
        "CHECK_IN"
      )
    ).to.be.reverted;
  });

  it("respects 1B supply cap", async () => {
    const { pabToken, minter, customer } = await loadFixture(deployAllFixture);
    const overCap = ethers.parseEther("1000000001");
    await expect(
      pabToken.connect(minter).mintReward(
        customer.address,
        overCap,
        ethers.keccak256(ethers.toUtf8Bytes("res_001")),
        "CHECK_IN"
      )
    ).to.be.reverted;
  });

  it("admin can pause/unpause transfers", async () => {
    const { pabToken, minter, owner, customer, user2 } = await loadFixture(deployAllFixture);
    await pabToken.connect(minter).mintReward(
      customer.address, ethers.parseEther("100"),
      ethers.keccak256(ethers.toUtf8Bytes("res_001")), "CHECK_IN"
    );
    await pabToken.connect(owner).pause();
    await expect(
      pabToken.connect(customer).transfer(user2.address, ethers.parseEther("10"))
    ).to.be.reverted;
    await pabToken.connect(owner).unpause();
    await pabToken.connect(customer).transfer(user2.address, ethers.parseEther("10"));
    expect(await pabToken.balanceOf(user2.address)).to.equal(ethers.parseEther("10"));
  });
});

// ── PabandiEscrow Tests ───────────────────────────────────────────────────────

describe("PabandiEscrow", () => {
  const reservationId = ethers.keccak256(ethers.toUtf8Bytes("reservation_001"));

  it("customer can create a native BNB escrow", async () => {
    const { escrow, customer, business } = await loadFixture(deployAllFixture);
    const amount = ethers.parseEther("0.1");

    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: amount });

    const e = await escrow.getEscrow(reservationId);
    expect(e.customer).to.equal(customer.address);
    expect(e.business).to.equal(business.address);
    expect(e.amount).to.equal(amount);
    expect(e.status).to.equal(0); // OPEN
  });

  it("relayer can release to business on COMPLETED", async () => {
    const { escrow, relayer, customer, business } = await loadFixture(deployAllFixture);
    const amount = ethers.parseEther("0.1");

    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: amount });
    const businessBefore = await ethers.provider.getBalance(business.address);
    
    await escrow.connect(relayer).releaseToBusinesss(reservationId);

    const businessAfter = await ethers.provider.getBalance(business.address);
    expect(businessAfter - businessBefore).to.equal(amount);

    const e = await escrow.getEscrow(reservationId);
    expect(e.status).to.equal(1); // RELEASED
  });

  it("relayer can refund customer on CANCELLED", async () => {
    const { escrow, relayer, customer, business } = await loadFixture(deployAllFixture);
    const amount = ethers.parseEther("0.1");

    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: amount });
    const customerBefore = await ethers.provider.getBalance(customer.address);

    await escrow.connect(relayer).refundCustomer(reservationId);

    const customerAfter = await ethers.provider.getBalance(customer.address);
    expect(customerAfter - customerBefore).to.equal(amount);

    const e = await escrow.getEscrow(reservationId);
    expect(e.status).to.equal(2); // REFUNDED
  });

  it("no-show splits 80/20 between business and treasury", async () => {
    const { escrow, relayer, customer, business, treasury } = await loadFixture(deployAllFixture);
    const amount = ethers.parseEther("1.0");

    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: amount });
    
    const businessBefore  = await ethers.provider.getBalance(business.address);
    const treasuryBefore  = await ethers.provider.getBalance(treasury.address);

    await escrow.connect(relayer).forfeitNoShow(reservationId);

    const businessAfter  = await ethers.provider.getBalance(business.address);
    const treasuryAfter  = await ethers.provider.getBalance(treasury.address);

    expect(businessAfter - businessBefore).to.equal(ethers.parseEther("0.8"));
    expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.2"));

    const e = await escrow.getEscrow(reservationId);
    expect(e.status).to.equal(3); // FORFEITED
  });

  it("cannot settle already-settled escrow", async () => {
    const { escrow, relayer, customer, business } = await loadFixture(deployAllFixture);
    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: ethers.parseEther("0.1") });
    await escrow.connect(relayer).releaseToBusinesss(reservationId);
    await expect(escrow.connect(relayer).refundCustomer(reservationId)).to.be.reverted;
  });

  it("non-relayer cannot release escrow", async () => {
    const { escrow, customer, business } = await loadFixture(deployAllFixture);
    await escrow.connect(customer).createEscrowNative(reservationId, business.address, { value: ethers.parseEther("0.1") });
    await expect(escrow.connect(customer).releaseToBusinesss(reservationId)).to.be.reverted;
  });
});

// ── PabandiSoulbound Tests ────────────────────────────────────────────────────

describe("PabandiSoulbound", () => {
  const pseudoId = "abc123def456";

  it("minter can mint a badge", async () => {
    const { soulbound, minter, customer } = await loadFixture(deployAllFixture);
    await soulbound.connect(minter).mintBadge(customer.address, 0, pseudoId, 85, 3);
    expect(await soulbound.balanceOf(customer.address)).to.equal(1);
  });

  it("badge is non-transferable", async () => {
    const { soulbound, minter, customer, user2 } = await loadFixture(deployAllFixture);
    await soulbound.connect(minter).mintBadge(customer.address, 0, pseudoId, 85, 3);
    const tokenId = await soulbound.walletTierToken(customer.address, 0);
    await expect(
      soulbound.connect(customer).transferFrom(customer.address, user2.address, tokenId)
    ).to.be.revertedWith("Soulbound: non-transferable");
  });

  it("verifyBadge returns correct result", async () => {
    const { soulbound, minter, customer } = await loadFixture(deployAllFixture);
    expect(await soulbound.verifyBadge(customer.address, 0)).to.equal(false);
    await soulbound.connect(minter).mintBadge(customer.address, 1, pseudoId, 90, 5);
    expect(await soulbound.verifyBadge(customer.address, 0)).to.equal(true);
    expect(await soulbound.verifyBadge(customer.address, 1)).to.equal(true);
    expect(await soulbound.verifyBadge(customer.address, 2)).to.equal(false);
  });

  it("cannot mint same tier twice for same wallet", async () => {
    const { soulbound, minter, customer } = await loadFixture(deployAllFixture);
    await soulbound.connect(minter).mintBadge(customer.address, 0, pseudoId, 80, 1);
    await expect(
      soulbound.connect(minter).mintBadge(customer.address, 0, pseudoId, 82, 2)
    ).to.be.reverted;
  });

  it("has non-empty tokenURI with on-chain SVG", async () => {
    const { soulbound, minter, customer } = await loadFixture(deployAllFixture);
    await soulbound.connect(minter).mintBadge(customer.address, 2, pseudoId, 95, 12);
    const tokenId = await soulbound.walletTierToken(customer.address, 2);
    const uri = await soulbound.tokenURI(tokenId);
    expect(uri).to.include("data:application/json;base64,");
  });
});
