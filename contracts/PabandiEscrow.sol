// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PabandiEscrow
 * @dev Decentralized escrow for no-show protection and reservations.
 */
contract PabandiEscrow {
    address public owner;
    address public oracle; // The Pabandi Backend Server
    uint256 public platformFeePercent = 2; // Default 2% fee

    struct Reservation {
        string reservationId;
        address customer;
        address business;
        uint256 amount;
        bool isResolved;
    }

    // Mapping from reservation ID (string) to Reservation struct
    mapping(string => Reservation) public reservations;

    event DepositCreated(string reservationId, address customer, address business, uint256 amount);
    event FundsReleasedToBusiness(string reservationId, uint256 amount, uint256 fee);
    event FundsRefundedToCustomer(string reservationId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle || msg.sender == owner, "Only oracle can resolve");
        _;
    }

    constructor(address _oracle) {
        owner = msg.sender;
        oracle = _oracle;
    }

    /**
     * @dev Customers call this to stake their deposit against a reservation.
     */
    function deposit(string memory _reservationId, address _business) external payable {
        require(msg.value > 0, "Deposit must be greater than 0");
        require(reservations[_reservationId].amount == 0, "Reservation already exists");

        reservations[_reservationId] = Reservation({
            reservationId: _reservationId,
            customer: msg.sender,
            business: _business,
            amount: msg.value,
            isResolved: false
        });

        emit DepositCreated(_reservationId, msg.sender, _business, msg.value);
    }

    /**
     * @dev Oracle calls this when a reservation is COMPLETED or NO_SHOW.
     * The business receives the deposit minus the platform fee.
     */
    function releaseToBusiness(string memory _reservationId) external onlyOracle {
        Reservation storage res = reservations[_reservationId];
        require(res.amount > 0, "Reservation not found");
        require(!res.isResolved, "Already resolved");

        res.isResolved = true;

        uint256 fee = (res.amount * platformFeePercent) / 100;
        uint256 businessShare = res.amount - fee;

        // Transfer to Business
        (bool successBiz, ) = res.business.call{value: businessShare}("");
        require(successBiz, "Transfer to business failed");

        // Transfer Fee to Owner/Treasury
        if (fee > 0) {
            (bool successFee, ) = owner.call{value: fee}("");
            require(successFee, "Transfer to treasury failed");
        }

        emit FundsReleasedToBusiness(_reservationId, businessShare, fee);
    }

    /**
     * @dev Oracle calls this when a reservation is CANCELLED by the business.
     * The customer gets a 100% full refund.
     */
    function refundToCustomer(string memory _reservationId) external onlyOracle {
        Reservation storage res = reservations[_reservationId];
        require(res.amount > 0, "Reservation not found");
        require(!res.isResolved, "Already resolved");

        res.isResolved = true;

        (bool success, ) = res.customer.call{value: res.amount}("");
        require(success, "Refund to customer failed");

        emit FundsRefundedToCustomer(_reservationId, res.amount);
    }

    /**
     * @dev Update the oracle address.
     */
    function setOracle(address _newOracle) external onlyOwner {
        oracle = _newOracle;
    }

    /**
     * @dev Update the platform fee percentage.
     */
    function setPlatformFeePercent(uint256 _newFee) external onlyOwner {
        require(_newFee <= 20, "Fee cannot exceed 20%");
        platformFeePercent = _newFee;
    }
}
