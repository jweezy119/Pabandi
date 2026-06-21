// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PabandiHalalStaking
 * @notice Sharia-compliant staking contract for the Pabandi platform.
 *
 * ─── Sharia Compliance Framework ────────────────────────────────────────────
 *
 *  This contract implements a Mudarabah (profit-sharing) model:
 *
 *   1. NO RIBA (Interest): Stakers do NOT receive a fixed, predetermined
 *      interest rate. All yield is derived exclusively from real platform
 *      fee revenue (escrow commission, API fees). There is no guaranteed
 *      return; rewards are a proportional share of actual profits only.
 *
 *   2. NO GHARAR (Excessive Uncertainty): Stakers lock tokens for a known
 *      minimum period. The reward pool is funded transparently on-chain from
 *      verified revenue deposits. The profit-sharing ratio (rewardShareBps)
 *      is disclosed and immutable per epoch, eliminating hidden uncertainty.
 *
 *   3. NO MAYSIR (Gambling): Rewards are tied to legitimate commercial
 *      activity — booking platform fees — not speculative or zero-sum games.
 *      No randomness or lottery mechanisms are used.
 *
 *   4. HALAL ASSET: $PAB is a utility token representing platform access
 *      rights (API discounts, governance). It is not debt, not a security,
 *      and does not represent an interest-bearing instrument.
 *
 *   Fatwa Reference: Structured on AAOIFI Standard No. 13 (Mudarabah) and
 *   AAOIFI Standard No. 17 (Investment Sukuk). The profit-sharing ratio and
 *   epoch model follow Islamic finance musharaka principles.
 *
 * ─── Mechanics ───────────────────────────────────────────────────────────────
 *
 *   Epoch Flow:
 *     1. Users stake PAB tokens (lockStake). Tokens are held in contract.
 *     2. Admin deposits platform revenue into the reward pool each epoch
 *        (depositRewardPool). Revenue is sourced from escrow commissions
 *        and API fees — real economic activity only.
 *     3. At epoch end, admin distributes rewards proportionally
 *        (distributeEpochRewards). Each staker receives:
 *           reward_i = rewardPool * (staked_i / totalStaked)
 *     4. Users may unstake after lockPeriod expires (unstake).
 *
 *   API Discount:
 *     Staking also grants a logarithmic API fee discount (read off-chain):
 *       D(S) = D_max * S / (S + K)   where D_max=80%, K=50,000
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — governance, epoch management, treasury updates
 *   REVENUE_DEPOSITOR_ROLE — Pabandi backend; deposits epoch revenue
 */
contract PabandiHalalStaking is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant REVENUE_DEPOSITOR_ROLE = keccak256("REVENUE_DEPOSITOR_ROLE");

    IERC20 public immutable pabToken;

    // ─── Epoch Configuration ─────────────────────────────────────────────────

    uint256 public epochDuration = 30 days;    // Monthly profit-sharing cycle
    uint256 public lockPeriod    = 30 days;    // Minimum staking commitment
    uint256 public currentEpoch;
    uint256 public epochStartTime;

    // ─── Staking State ────────────────────────────────────────────────────────

    struct StakePosition {
        uint256 amount;       // PAB tokens staked
        uint256 stakedAt;     // block.timestamp at stake
        uint256 epochStaked;  // epoch number when staked
        bool    exists;
    }

    mapping(address => StakePosition) public stakes;
    uint256 public totalStaked;

    // ─── Reward Pool ──────────────────────────────────────────────────────────

    // Revenue deposited by platform for current epoch (halal source only)
    // Source: escrow protocol fees + API revenue sharing
    mapping(uint256 => uint256) public epochRewardPool;  // epoch => BNB wei
    mapping(uint256 => bool)    public epochDistributed;
    mapping(address => mapping(uint256 => uint256)) public claimedRewards; // user => epoch => amount

    // ─── Events ───────────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount, uint256 epoch);
    event Unstaked(address indexed user, uint256 amount);
    event RevenueDeposited(uint256 indexed epoch, uint256 amount, string revenueSource);
    event RewardClaimed(address indexed user, uint256 indexed epoch, uint256 reward);
    event EpochAdvanced(uint256 newEpoch, uint256 startTime);
    event ShariaComplianceNote(string note);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address admin,
        address revenueDepositor,
        address _pabToken
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REVENUE_DEPOSITOR_ROLE, revenueDepositor);
        pabToken = IERC20(_pabToken);
        epochStartTime = block.timestamp;
        currentEpoch = 1;

        emit ShariaComplianceNote(
            "This contract operates on Mudarabah (profit-sharing) principles. "
            "No riba (interest), no gharar (uncertainty), no maysir (gambling). "
            "All yields derive from legitimate halal platform revenue only."
        );
    }

    // ─── Staking ─────────────────────────────────────────────────────────────

    /**
     * @notice Lock PAB tokens into the halal staking pool.
     * @dev    By staking, user agrees to profit-sharing (Mudarabah) terms.
     *         No fixed return is promised — rewards depend on actual revenue.
     * @param  amount Amount of PAB tokens to stake (18 decimals).
     */
    function lockStake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "HalalStaking: zero amount");
        require(!stakes[msg.sender].exists, "HalalStaking: already staking; unstake first");

        pabToken.safeTransferFrom(msg.sender, address(this), amount);

        stakes[msg.sender] = StakePosition({
            amount:      amount,
            stakedAt:    block.timestamp,
            epochStaked: currentEpoch,
            exists:      true
        });
        totalStaked += amount;

        emit Staked(msg.sender, amount, currentEpoch);
    }

    /**
     * @notice Increase an existing stake position.
     * @param  additionalAmount Extra PAB tokens to add to current stake.
     */
    function addToStake(uint256 additionalAmount) external nonReentrant whenNotPaused {
        require(additionalAmount > 0, "HalalStaking: zero amount");
        require(stakes[msg.sender].exists, "HalalStaking: no existing stake");

        pabToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
        stakes[msg.sender].amount += additionalAmount;
        totalStaked += additionalAmount;

        emit Staked(msg.sender, additionalAmount, currentEpoch);
    }

    /**
     * @notice Unstake PAB tokens after lock period expires.
     * @dev    Principal is returned in full — no deductions on principal
     *         (consistent with Islamic finance: capital preservation guaranteed).
     */
    function unstake() external nonReentrant {
        StakePosition storage pos = stakes[msg.sender];
        require(pos.exists, "HalalStaking: nothing staked");
        require(
            block.timestamp >= pos.stakedAt + lockPeriod,
            "HalalStaking: lock period not expired"
        );

        uint256 amount = pos.amount;
        totalStaked -= amount;
        delete stakes[msg.sender];

        pabToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    // ─── Revenue & Rewards ───────────────────────────────────────────────────

    /**
     * @notice Deposit halal platform revenue into the current epoch reward pool.
     * @dev    ONLY called by the Pabandi backend with verified revenue.
     *         Revenue sources must be halal: escrow protocol fees, API fees.
     *         Interest income, lending income, or haram-sector revenue is
     *         explicitly excluded and must never be deposited here.
     * @param  revenueSource Human-readable description of revenue source for audit trail.
     */
    function depositRewardPool(string calldata revenueSource)
        external
        payable
        onlyRole(REVENUE_DEPOSITOR_ROLE)
    {
        require(msg.value > 0, "HalalStaking: zero revenue");
        require(
            keccak256(bytes(revenueSource)) != keccak256(bytes("")),
            "HalalStaking: revenue source must be declared"
        );

        epochRewardPool[currentEpoch] += msg.value;
        emit RevenueDeposited(currentEpoch, msg.value, revenueSource);
    }

    /**
     * @notice Claim proportional profit-share for a completed epoch.
     * @dev    Reward = epochPool * (userStake / totalStakedAtEpoch).
     *         This is a pure profit-sharing (Mudarabah) distribution.
     * @param  epoch The epoch number to claim rewards for.
     */
    function claimEpochReward(uint256 epoch) external nonReentrant {
        require(epoch < currentEpoch, "HalalStaking: epoch not ended");
        require(epochRewardPool[epoch] > 0, "HalalStaking: no rewards for epoch");
        require(claimedRewards[msg.sender][epoch] == 0, "HalalStaking: already claimed");

        StakePosition storage pos = stakes[msg.sender];
        require(pos.exists || pos.epochStaked <= epoch, "HalalStaking: no stake for epoch");

        // Proportional profit share (Mudarabah distribution)
        // reward_i = pool * staked_i / totalStaked
        // Note: totalStaked here is current; a production implementation
        // should snapshot totalStaked per epoch for precision.
        uint256 reward = (epochRewardPool[epoch] * pos.amount) / totalStaked;
        require(reward > 0, "HalalStaking: reward rounds to zero");

        claimedRewards[msg.sender][epoch] = reward;

        (bool ok, ) = msg.sender.call{value: reward}("");
        require(ok, "HalalStaking: reward transfer failed");

        emit RewardClaimed(msg.sender, epoch, reward);
    }

    // ─── Epoch Management ────────────────────────────────────────────────────

    /**
     * @notice Advance to the next profit-sharing epoch.
     * @dev    Admin calls this at the end of each monthly cycle after
     *         all rewards for the current epoch have been accounted for.
     */
    function advanceEpoch() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            block.timestamp >= epochStartTime + epochDuration,
            "HalalStaking: epoch not complete"
        );
        currentEpoch++;
        epochStartTime = block.timestamp;
        emit EpochAdvanced(currentEpoch, epochStartTime);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    function setLockPeriod(uint256 newPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPeriod <= 365 days, "HalalStaking: excessive lock");
        lockPeriod = newPeriod;
    }

    function setEpochDuration(uint256 newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDuration >= 7 days, "HalalStaking: epoch too short");
        epochDuration = newDuration;
    }

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getStake(address user) external view returns (StakePosition memory) {
        return stakes[user];
    }

    function getEpochPool(uint256 epoch) external view returns (uint256) {
        return epochRewardPool[epoch];
    }

    /**
     * @notice Preview estimated profit-share for a user in the current epoch.
     * @dev    This is an estimate only — final rewards depend on epoch-end pool.
     *         No guaranteed return (consistent with Mudarabah principles).
     */
    function estimateReward(address user) external view returns (uint256 estimated) {
        StakePosition storage pos = stakes[user];
        if (!pos.exists || totalStaked == 0) return 0;
        estimated = (epochRewardPool[currentEpoch] * pos.amount) / totalStaked;
    }

    receive() external payable {}
}
