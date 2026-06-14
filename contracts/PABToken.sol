// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PABToken
 * @notice Pabandi Reliability Token — the utility token powering the Pabandi
 *         loyalty and trust ecosystem. Earned by customers for honoring bookings
 *         and by businesses for providing excellent service.
 *
 * Supply cap: 1,000,000,000 PAB (1 billion)
 * Decimals:   18 (standard ERC-20)
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — can grant/revoke all roles, upgrade contracts
 *   MINTER_ROLE        — Pabandi backend relayer; mints rewards
 *   PAUSER_ROLE        — emergency pause of all transfers
 *
 * Token Utility:
 *   • Withdraw to Solana cross-chain bridge (future)
 *   • Burn for governance votes (future)
 *   • Redeem for business perks / loyalty benefits
 */
contract PABToken is ERC20Burnable, ERC20Capped, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ─── Events ───────────────────────────────────────────────────────────────
    event RewardMinted(address indexed to, uint256 amount, bytes32 indexed reservationId, string rewardType);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin, address minter)
        ERC20("Pabandi Reliability Token", "PAB")
        ERC20Capped(1_000_000_000 * 10 ** 18)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint PAB rewards to a user address.
     * @param to            Recipient wallet address.
     * @param amount        Token amount in wei (18 decimals).
     * @param reservationId Off-chain reservation ID for event indexing.
     * @param rewardType    Human-readable reward type ("CHECK_IN", "GOOGLE_REVIEW", etc.)
     */
    function mintReward(
        address to,
        uint256 amount,
        bytes32 reservationId,
        string calldata rewardType
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        _mint(to, amount);
        emit RewardMinted(to, amount, reservationId, rewardType);
    }

    /**
     * @notice Convenience batch mint for multiple recipients (e.g. monthly bonuses).
     */
    function batchMintReward(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(recipients.length == amounts.length, "PAB: length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }

    // ─── Pause ────────────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ─── Required overrides ───────────────────────────────────────────────────

    function _mint(address account, uint256 amount) internal override(ERC20, ERC20Capped) {
        super._mint(account, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal override whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
