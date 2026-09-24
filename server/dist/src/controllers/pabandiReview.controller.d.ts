import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
export declare const STAR_TIER_POINTS: {
    readonly tara: {
        readonly min: 0;
        readonly name: "Tara";
        readonly nameUrdu: "تارا";
        readonly color: "from-slate-400 to-slate-500";
    };
    readonly 'sitara-e-noor': {
        readonly min: 100;
        readonly name: "Sitara-e-Noor";
        readonly nameUrdu: "ستارہ نور";
        readonly color: "from-blue-400 to-blue-500";
    };
    readonly 'sitara-e-roshan': {
        readonly min: 500;
        readonly name: "Sitara-e-Roshan";
        readonly nameUrdu: "ستارہ روشن";
        readonly color: "from-amber-400 to-yellow-500";
    };
    readonly 'sitara-e-darakshan': {
        readonly min: 2000;
        readonly name: "Sitara-e-Darakshan";
        readonly nameUrdu: "ستارہ درخشاں";
        readonly color: "from-purple-400 via-pink-500 to-rose-500";
    };
    readonly 'sitara-e-izzat': {
        readonly min: 10000;
        readonly name: "Sitara-e-Izzat";
        readonly nameUrdu: "ستارہ عزت";
        readonly color: "from-yellow-300 via-orange-400 to-red-500";
    };
};
export declare const STAR_TIER_ORDER: readonly ["tara", "sitara-e-noor", "sitara-e-roshan", "sitara-e-darakshan", "sitara-e-izzat"];
export declare function calculateStarTier(points: number): keyof typeof STAR_TIER_POINTS;
/**
 * POST /api/v1/reviews
 * Create a verified review after check-in.
 * Awards star points: rating * 10 + 10 bonus for verified check-in.
 * Also credits $PAB: 200 per review (matches existing cryptoService rules).
 */
export declare const createReview: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/reviews/:id/upvote
 * Upvote a review. Only users with a verified check-in at the same business can upvote.
 * Each upvote = 5 star power points to the reviewer.
 */
export declare const upvoteReview: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/reviews/:id/upvotes
 * Get upvotes on a review
 */
export declare const getReviewUpvotes: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/star-power/:userId
 * Get a user's Star Power profile
 */
export declare const getStarPower: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * GET /api/v1/star-power/business/:businessId
 * Get Star Power leaderboard for a business's reviewers
 */
export declare const getBusinessStarLeaderboard: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * POST /api/v1/reviews/:id/reply
 * Business owner responds publicly to a verified review (Yelp-style).
 * Only the owning business may reply, once or updated.
 */
export declare const replyToReview: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=pabandiReview.controller.d.ts.map