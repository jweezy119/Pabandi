"use strict";
/**
 * blockchain.types.ts
 * ─────────────────────────────────────────────
 * Shared types for Pabandi's blockchain integration (BSC + Solana).
 * Defined here so server code doesn't cross rootDir boundaries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BADGE_TIER_CONFIG = exports.BADGE_TIER_NAMES = exports.BadgeTier = void 0;
exports.computeEligibleTier = computeEligibleTier;
var BadgeTier;
(function (BadgeTier) {
    BadgeTier[BadgeTier["Bronze"] = 0] = "Bronze";
    BadgeTier[BadgeTier["Silver"] = 1] = "Silver";
    BadgeTier[BadgeTier["Gold"] = 2] = "Gold";
    BadgeTier[BadgeTier["Platinum"] = 3] = "Platinum";
})(BadgeTier || (exports.BadgeTier = BadgeTier = {}));
exports.BADGE_TIER_NAMES = {
    [BadgeTier.Bronze]: 'Bronze Patron',
    [BadgeTier.Silver]: 'Silver Reliable',
    [BadgeTier.Gold]: 'Gold Trustee',
    [BadgeTier.Platinum]: 'Platinum Oracle',
};
exports.BADGE_TIER_CONFIG = {
    [BadgeTier.Bronze]: { name: 'Bronze Patron', emoji: '🥉', minBookings: 1, minShowRate: 70 },
    [BadgeTier.Silver]: { name: 'Silver Reliable', emoji: '🥈', minBookings: 5, minShowRate: 80 },
    [BadgeTier.Gold]: { name: 'Gold Trustee', emoji: '🥇', minBookings: 10, minShowRate: 90 },
    [BadgeTier.Platinum]: { name: 'Platinum Oracle', emoji: '💎', minBookings: 25, minShowRate: 97 },
};
/**
 * Compute which badge tier a user is eligible for based on stats.
 */
function computeEligibleTier(totalBookings, showRate) {
    if (totalBookings >= 25 && showRate >= 97)
        return BadgeTier.Platinum;
    if (totalBookings >= 10 && showRate >= 90)
        return BadgeTier.Gold;
    if (totalBookings >= 5 && showRate >= 80)
        return BadgeTier.Silver;
    if (totalBookings >= 1 && showRate >= 70)
        return BadgeTier.Bronze;
    return null;
}
//# sourceMappingURL=blockchain.types.js.map