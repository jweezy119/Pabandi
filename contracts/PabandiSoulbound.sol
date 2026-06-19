// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PabandiSoulbound
 * @notice Non-transferable (Soulbound) NFT badges representing a customer's
 *         Pabandi loyalty tier. Once minted to a wallet, they cannot be moved.
 *         Businesses can verify these on-chain to unlock tier perks.
 *
 * Tiers:
 *   0 — Bronze Patron    (1+ bookings, 70%+ show rate)
 *   1 — Silver Reliable  (5+ bookings, 80%+ show rate)
 *   2 — Gold Trustee     (10+ bookings, 90%+ show rate)
 *   3 — Platinum Oracle  (25+ bookings, 97%+ show rate)
 *
 * Properties:
 *   • Transfer disabled — any transfer (except mint) reverts.
 *   • Metadata stored fully on-chain (base64 SVG + JSON).
 *   • One badge per tier per wallet; higher tier supersedes lower.
 *   • Minter can upgrade a user's tier (burns old, mints new).
 *
 * Roles:
 *   DEFAULT_ADMIN_ROLE — governance
 *   MINTER_ROLE        — Pabandi backend
 */
contract PabandiSoulbound is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    Counters.Counter private _tokenIds;

    // ─── Tier Config ──────────────────────────────────────────────────────────

    struct TierConfig {
        string  name;
        string  emoji;
        string  color;       // hex color for SVG
        string  description;
        uint16  minBookings;
        uint8   minShowRate; // percentage 0–100
    }

    TierConfig[4] private TIERS = [
        TierConfig("Bronze Patron",   "🥉", "#CD7F32", "First steps on your Pabandi journey",          1,  70),
        TierConfig("Silver Reliable", "🥈", "#8A9BB0", "Consistent performer — businesses trust you",   5,  80),
        TierConfig("Gold Trustee",    "🥇", "#D97706", "Top-tier reliability, rare and respected",      10, 90),
        TierConfig("Platinum Oracle", "💎", "#0284C7", "Elite. Less than 3% of users ever reach this",  25, 97)
    ];

    // ─── State ────────────────────────────────────────────────────────────────

    struct BadgeData {
        uint8   tier;
        uint16  reliabilityScore;
        uint32  totalBookings;
        uint64  mintedAt;
        string  pseudonymousId;  // privacy-preserving ID, not the real userId
        string  aiTrustProfile;  // DashScope AI generated behavioral summary
    }

    mapping(uint256 => BadgeData) public badgeData;
    // wallet => tokenId (0 = none). Each wallet holds at most one badge per tier.
    mapping(address => mapping(uint8 => uint256)) public walletTierToken;
    // tokenId => wallet (for reversal lookup)
    mapping(uint256 => address) public tokenOwner;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BadgeMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint8 tier,
        string pseudonymousId,
        uint16 reliabilityScore,
        string aiTrustProfile
    );
    event BadgeUpgraded(
        address indexed wallet,
        uint8 fromTier,
        uint8 toTier,
        uint256 newTokenId
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address admin, address minter) ERC721("Pabandi Soulbound Badge", "PSBDG") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    // ─── Minting ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint a soulbound badge for a customer.
     * @param to               Customer's wallet address.
     * @param tier             Tier index (0=Bronze, 1=Silver, 2=Gold, 3=Platinum).
     * @param pseudonymousId   Privacy-preserving ID (HMAC of real userId).
     * @param reliabilityScore Snapshot reliability score at mint time.
     * @param totalBookings    Snapshot total bookings at mint time.
     * @param aiTrustProfile   DashScope AI generated trust profile.
     */
    function mintBadge(
        address to,
        uint8   tier,
        string calldata pseudonymousId,
        uint16  reliabilityScore,
        uint32  totalBookings,
        string calldata aiTrustProfile
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(tier < 4, "Soulbound: invalid tier");
        require(to != address(0), "Soulbound: zero address");
        require(walletTierToken[to][tier] == 0, "Soulbound: tier already minted");

        _tokenIds.increment();
        tokenId = _tokenIds.current();

        _safeMint(to, tokenId);
        tokenOwner[tokenId] = to;
        walletTierToken[to][tier] = tokenId;

        badgeData[tokenId] = BadgeData({
            tier:             tier,
            reliabilityScore: reliabilityScore,
            totalBookings:    totalBookings,
            mintedAt:         uint64(block.timestamp),
            pseudonymousId:   pseudonymousId,
            aiTrustProfile:   aiTrustProfile
        });

        _setTokenURI(tokenId, _buildTokenURI(tokenId));

        emit BadgeMinted(tokenId, to, tier, pseudonymousId, reliabilityScore, aiTrustProfile);
    }

    /**
     * @notice Upgrade a wallet's highest tier by burning old and minting new.
     * @dev Only upgrades (higher tier), never downgrades.
     */
    function upgradeBadge(
        address wallet,
        uint8   newTier,
        string calldata pseudonymousId,
        uint16  reliabilityScore,
        uint32  totalBookings,
        string calldata aiTrustProfile
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(newTier < 4, "Soulbound: invalid tier");
        uint8 currentHighest = getHighestTier(wallet);
        require(newTier > currentHighest || walletTierToken[wallet][currentHighest] == 0,
            "Soulbound: not an upgrade");

        uint8 oldTier = currentHighest;
        emit BadgeUpgraded(wallet, oldTier, newTier, 0); // tokenId updated below

        uint256 newTokenId = this.mintBadge(wallet, newTier, pseudonymousId, reliabilityScore, totalBookings, aiTrustProfile);
        emit BadgeUpgraded(wallet, oldTier, newTier, newTokenId);
        return newTokenId;
    }

    // ─── Soulbound enforcement ────────────────────────────────────────────────

    /**
     * @dev Block all transfers except mint (from == address(0)).
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        require(from == address(0), "Soulbound: non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the highest tier badge token ID a wallet holds (0 if none).
     */
    function getHighestTier(address wallet) public view returns (uint8) {
        for (uint8 t = 3; t < 4; t--) {  // 3,2,1,0
            if (walletTierToken[wallet][t] != 0) return t;
            if (t == 0) break;
        }
        return 0;
    }

    /**
     * @notice Verify a badge: returns true if wallet holds >= the given tier.
     */
    function verifyBadge(address wallet, uint8 minTier) external view returns (bool) {
        for (uint8 t = minTier; t < 4; t++) {
            if (walletTierToken[wallet][t] != 0) return true;
        }
        return false;
    }

    // ─── On-chain SVG Metadata ────────────────────────────────────────────────

    function _buildTokenURI(uint256 tokenId) internal view returns (string memory) {
        BadgeData memory data = badgeData[tokenId];
        TierConfig memory tier = TIERS[data.tier];

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<defs><radialGradient id="bg" cx="50%" cy="50%" r="70%">',
            '<stop offset="0%" stop-color="', tier.color, '22"/>',
            '<stop offset="100%" stop-color="#0a0a0a"/></radialGradient></defs>',
            '<rect width="400" height="400" fill="url(#bg)" rx="24"/>',
            '<circle cx="200" cy="160" r="70" fill="', tier.color, '22" stroke="', tier.color, '" stroke-width="2"/>',
            '<text x="200" y="180" text-anchor="middle" font-size="56">', tier.emoji, '</text>',
            '<text x="200" y="250" text-anchor="middle" fill="', tier.color,
            '" font-family="Arial,sans-serif" font-size="20" font-weight="800">', tier.name, '</text>',
            '<text x="200" y="278" text-anchor="middle" fill="#ffffff99" font-family="Arial,sans-serif" font-size="11">',
            'Reliability Score: ', uint256(data.reliabilityScore).toString(), '/100</text>',
            '<text x="200" y="298" text-anchor="middle" fill="#ffffff66" font-family="Arial,sans-serif" font-size="10">',
            'Bookings: ', uint256(data.totalBookings).toString(), '</text>',
            '<text x="200" y="360" text-anchor="middle" fill="#ffffff33" font-family="Arial,sans-serif" font-size="9">',
            'PABANDI SOULBOUND NFT &#x2022; NON-TRANSFERABLE</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Pabandi ', tier.name, ' Badge",',
            '"description":"', tier.description, '. Soulbound — non-transferable.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Tier","value":"', tier.name, '"},',
            '{"trait_type":"Reliability Score","value":', uint256(data.reliabilityScore).toString(), '},',
            '{"trait_type":"Total Bookings","value":', uint256(data.totalBookings).toString(), '},',
            '{"trait_type":"Soulbound","value":true},',
            '{"trait_type":"AI Trust Profile","value":"', data.aiTrustProfile, '"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    // ─── Required overrides ───────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
