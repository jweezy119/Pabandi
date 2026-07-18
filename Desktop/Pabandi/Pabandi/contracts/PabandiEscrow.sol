// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PabandiEscrow
 * @notice Escrow contract for Pabandi booking reservations.
 *         Customer deposits ETH/MON when booking. Business claims funds
 *         after successful check-in; customer can claim a refund if the
 *         business no-shows (after a deadline). Platform can settle
 *         disputes. This contract is the onchain component required for
 *         the BuildAnything → Spark hackathon submission.
 */
contract PabandiEscrow {
    // ─── State ──────────────────────────────────────────────────────────────────

    struct Reservation {
        string    reservationId;   // human-readable booking ID (IPFS / backend UUID)
        address   customer;
        address   business;
        uint256   amount;          // wei deposited
        uint256   createdAt;
        uint256   deadline;        // after this, customer can claim refund
        bool      isResolved;
        Status    status;
    }

    enum Status { PENDING, COMPLETED, REFUNDED, DISPUTED }

    // reservationId => Reservation
    mapping(string => Reservation) public reservations;

    // ─── Events ─────────────────────────────────────────────────────────────────

    event DepositCreated(
        string  indexed reservationId,
        address indexed customer,
        address indexed business,
        uint256  amount
    );
    event ReleaseToBusiness(string indexed reservationId, uint256 amount);
    event RefundToCustomer(string indexed reservationId, uint256 amount);
    event DisputeOpened(string indexed reservationId, address indexed challenger);
    event DisputeSettled(string indexed reservationId, address winner, uint256 amount);

    // ─── Errors ─────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error ReservationNotFound();
    error AlreadyResolved();
    error NotPending();
    error Unauthorized();
    error DeadlineNotReached();
    error InsufficientBalance();

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyCustomer(string calldata reservationId) {
        if (msg.sender != reservations[reservationId].customer) revert Unauthorized();
        _;
    }

    modifier onlyBusiness(string calldata reservationId) {
        if (msg.sender != reservations[reservationId].business) revert Unauthorized();
        _;
    }

    // ─── Core Functions ─────────────────────────────────────────────────────────

    /**
     * @notice Customer deposits funds to hold a reservation slot.
     * @param reservationId Unique booking identifier from backend.
     * @param business      The wallet address of the business.
     */
    function deposit(string calldata reservationId, address business) external payable {
        if (business == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroAmount();

        Reservation storage r = reservations[reservationId];

        if (r.isResolved) revert AlreadyResolved();

        r.reservationId = reservationId;
        r.customer      = msg.sender;
        r.business      = business;
        r.amount        = msg.value;
        r.createdAt     = block.timestamp;
        r.deadline      = block.timestamp + 48 hours; // customer gets refund after 48h if no-show
        r.status        = Status.PENDING;

        emit DepositCreated(reservationId, msg.sender, business, msg.value);
    }

    /**
     * @notice Business claims funds when customer successfully checks in.
     * @param reservationId The booking ID.
     */
    function releaseToBusiness(string calldata reservationId) external onlyBusiness(reservationId) {
        Reservation storage r = reservations[reservationId];
        if (r.isResolved) revert AlreadyResolved();
        if (r.status != Status.PENDING) revert NotPending();

        r.isResolved = true;
        r.status = Status.COMPLETED;

        uint256 amt = r.amount;
        r.amount = 0;

        (bool ok, ) = r.business.call{value: amt}("");
        if (!ok) revert InsufficientBalance();

        emit ReleaseToBusiness(reservationId, amt);
    }

    /**
     * @notice Customer claims full refund if business no-shows past deadline.
     * @param reservationId The booking ID.
     */
    function refundToCustomer(string calldata reservationId)
        external
        onlyCustomer(reservationId)
    {
        Reservation storage r = reservations[reservationId];
        if (r.isResolved) revert AlreadyResolved();
        if (r.status != Status.PENDING) revert NotPending();
        if (block.timestamp < r.deadline) revert DeadlineNotReached();

        r.isResolved = true;
        r.status = Status.REFUNDED;

        uint256 amt = r.amount;
        r.amount = 0;

        (bool ok, ) = r.customer.call{value: amt}("");
        if (!ok) revert InsufficientBalance();

        emit RefundToCustomer(reservationId, amt);
    }

    /**
     * @notice Either party opens a dispute. Platform (owner) settles later.
     */
    function openDispute(string calldata reservationId) external {
        Reservation storage r = reservations[reservationId];
        if (r.isResolved) revert AlreadyResolved();
        if (msg.sender != r.customer && msg.sender != r.business) revert Unauthorized();
        if (r.status != Status.PENDING) revert NotPending();

        r.status = Status.DISPUTED;
        emit DisputeOpened(reservationId, msg.sender);
    }

    // ─── Read Helpers ───────────────────────────────────────────────────────────

    function getReservation(string calldata reservationId)
        external
        view
        returns (string memory, address, address, uint256, uint256, bool, Status)
    {
        Reservation storage r = reservations[reservationId];
        return (r.reservationId, r.customer, r.business, r.amount, r.deadline, r.isResolved, r.status);
    }

    // ─── Receive / Fallback ─────────────────────────────────────────────────────

    receive() external payable {}
    fallback() external payable {}
}
