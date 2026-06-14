// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PabandiEscrow
 * @notice Trustless booking-deposit escrow for the Pabandi reservation platform.
 *
 * Flow:
 *   1. Customer calls createEscrow() with native BNB or BUSD, locking deposit.
 *   2. On reservation COMPLETED → Pabandi relayer calls releaseToBusinesss().
 *      Business receives deposit; customer keeps full PAB reward.
 *   3. On CANCELLED (within policy) → relayer calls refundCustomer().
 *      Customer gets 100% back.
 *   4. On NO_SHOW → relayer calls forfeitNoShow().
 *      80% sent to business. 20% sent to Pabandi treasury.
 *
 * Supports:
 *   • Native BNB deposits
 *   • ERC-20 stablecoin deposits (BUSD / USDT)
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — governance, treasury updates
 *   RELAYER_ROLE       — Pabandi backend; triggers release/refund/forfeit
 */
contract PabandiEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // ─── Structs ──────────────────────────────────────────────────────────────

    enum EscrowStatus { OPEN, RELEASED, REFUNDED, FORFEITED }

    struct Escrow {
        address customer;
        address business;
        address token;       // address(0) = native BNB
        uint256 amount;
        uint64  createdAt;
        EscrowStatus status;
        bool    exists;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    // reservationId (bytes32 = keccak256 of off-chain ID string) => Escrow
    mapping(bytes32 => Escrow) public escrows;

    address public treasury;
    uint256 public noShowTreasuryBps = 2000; // 20% in basis points
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─── Events ───────────────────────────────────────────────────────────────

    event EscrowCreated(
        bytes32 indexed reservationId,
        address indexed customer,
        address indexed business,
        address token,
        uint256 amount
    );
    event EscrowReleased(bytes32 indexed reservationId, address indexed business, uint256 amount);
    event EscrowRefunded(bytes32 indexed reservationId, address indexed customer, uint256 amount);
    event NoShowForfeit(
        bytes32 indexed reservationId,
        address indexed business,
        uint256 businessAmount,
        uint256 treasuryAmount
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event NoShowSplitUpdated(uint256 newBps);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address admin, address relayer, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
        treasury = _treasury;
    }

    // ─── Customer Actions ─────────────────────────────────────────────────────

    /**
     * @notice Create an escrow for a reservation deposit in native BNB.
     * @param reservationId keccak256 hash of the off-chain reservation ID string.
     * @param business      The business wallet address to receive on completion.
     */
    function createEscrowNative(
        bytes32 reservationId,
        address business
    ) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Escrow: zero deposit");
        require(business != address(0), "Escrow: invalid business");
        require(!escrows[reservationId].exists, "Escrow: already exists");

        escrows[reservationId] = Escrow({
            customer:  msg.sender,
            business:  business,
            token:     address(0),
            amount:    msg.value,
            createdAt: uint64(block.timestamp),
            status:    EscrowStatus.OPEN,
            exists:    true
        });

        emit EscrowCreated(reservationId, msg.sender, business, address(0), msg.value);
    }

    /**
     * @notice Create an escrow for a reservation deposit in ERC-20 (BUSD/USDT).
     * @param reservationId keccak256 hash of the off-chain reservation ID string.
     * @param business      The business wallet address to receive on completion.
     * @param token         ERC-20 token address.
     * @param amount        Token amount (in token decimals).
     */
    function createEscrowToken(
        bytes32 reservationId,
        address business,
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Escrow: zero deposit");
        require(business != address(0), "Escrow: invalid business");
        require(token != address(0), "Escrow: use createEscrowNative for BNB");
        require(!escrows[reservationId].exists, "Escrow: already exists");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        escrows[reservationId] = Escrow({
            customer:  msg.sender,
            business:  business,
            token:     token,
            amount:    amount,
            createdAt: uint64(block.timestamp),
            status:    EscrowStatus.OPEN,
            exists:    true
        });

        emit EscrowCreated(reservationId, msg.sender, business, token, amount);
    }

    // ─── Relayer Actions ──────────────────────────────────────────────────────

    /**
     * @notice Release full deposit to business on reservation COMPLETED.
     */
    function releaseToBusinesss(bytes32 reservationId)
        external onlyRole(RELAYER_ROLE) nonReentrant
    {
        Escrow storage e = _requireOpen(reservationId);
        e.status = EscrowStatus.RELEASED;

        _send(e.business, e.token, e.amount);
        emit EscrowReleased(reservationId, e.business, e.amount);
    }

    /**
     * @notice Refund full deposit to customer on CANCELLED reservation.
     */
    function refundCustomer(bytes32 reservationId)
        external onlyRole(RELAYER_ROLE) nonReentrant
    {
        Escrow storage e = _requireOpen(reservationId);
        e.status = EscrowStatus.REFUNDED;

        _send(e.customer, e.token, e.amount);
        emit EscrowRefunded(reservationId, e.customer, e.amount);
    }

    /**
     * @notice Forfeit deposit on NO_SHOW: 80% → business, 20% → treasury.
     */
    function forfeitNoShow(bytes32 reservationId)
        external onlyRole(RELAYER_ROLE) nonReentrant
    {
        Escrow storage e = _requireOpen(reservationId);
        e.status = EscrowStatus.FORFEITED;

        uint256 treasuryShare = (e.amount * noShowTreasuryBps) / BPS_DENOMINATOR;
        uint256 businessShare = e.amount - treasuryShare;

        _send(e.business, e.token, businessShare);
        _send(treasury,   e.token, treasuryShare);

        emit NoShowForfeit(reservationId, e.business, businessShare, treasuryShare);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "Escrow: zero address");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setNoShowTreasuryBps(uint256 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bps <= 5000, "Escrow: max 50%");
        noShowTreasuryBps = bps;
        emit NoShowSplitUpdated(bps);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getEscrow(bytes32 reservationId) external view returns (Escrow memory) {
        return escrows[reservationId];
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _requireOpen(bytes32 reservationId) internal view returns (Escrow storage e) {
        e = escrows[reservationId];
        require(e.exists, "Escrow: not found");
        require(e.status == EscrowStatus.OPEN, "Escrow: already settled");
    }

    function _send(address to, address token, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = to.call{ value: amount }("");
            require(ok, "Escrow: BNB transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
