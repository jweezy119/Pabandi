import { prisma } from '../utils/database';

/**
 * Trust-Score matching for the Agent Marketplace.
 *
 * Given the skills a posted project requires, finds trust passports whose
 * declared skill tags overlap, ranked by Trust Score.
 */

export interface MatchedProvider {
  passportId: string;
  handle: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  /** Trust Score — TrustPassport.score normalised to 0-100. */
  overallScore: number;
  level: string | null;
  verifiedIdentity: boolean;
  skills: string[];
  matchedSkills: string[];
  /** Completed deliveries on record (PassportGigHistory rows). */
  completedProjects: number;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Candidates are scored client-side in three passes — skill overlap, then
 * Trust Score — because Postgres's default `DESC` ordering puts `score: null`
 * passports FIRST, which would rank unscored accounts above verified ones.
 * List is capped to keep it bounded; there are not enough passports to matter.
 */
export async function findMatchedProviders(
  requiredSkills: string[],
  limit = 3,
): Promise<MatchedProvider[]> {
  const wanted = new Set(requiredSkills.map(norm).filter(Boolean));
  if (wanted.size === 0) return [];

  const candidates = await prisma.trustPassport.findMany({
    where: {
      visibility: { not: 'PRIVATE' },
      showOnPublicProfile: true,
      fraudFlag: false,
      escrowTheftFlag: false,
    },
    orderBy: [{ claimsCount: 'desc' }, { createdAt: 'asc' }],
    take: 500,
    select: {
      id: true,
      handle: true,
      displayName: true,
      headline: true,
      avatarUrl: true,
      score: true,
      level: true,
      verifiedIdentity: true,
      skills: true,
      _count: { select: { gigHistory: true } },
    },
  });

  const matches = candidates
    .map((passport) => {
      const skills = Array.isArray(passport.skills)
        ? passport.skills.filter((s): s is string => typeof s === 'string')
        : [];
      const matchedSkills = skills.filter((s) => wanted.has(norm(s)));
      return { passport, skills, matchedSkills };
    })
    .filter((m) => m.matchedSkills.length > 0)
    .sort(
      (a, b) =>
        b.matchedSkills.length - a.matchedSkills.length ||
        (b.passport.score ?? 0) - (a.passport.score ?? 0) ||
        (b.passport._count.gigHistory - a.passport._count.gigHistory),
    )
    .slice(0, limit);

  return matches.map(({ passport, skills, matchedSkills }) => ({
    passportId: passport.id,
    handle: passport.handle,
    displayName: passport.displayName,
    headline: passport.headline,
    avatarUrl: passport.avatarUrl,
    overallScore: passport.score ?? 0,
    level: passport.level,
    verifiedIdentity: Boolean(passport.verifiedIdentity),
    skills,
    matchedSkills,
    completedProjects: passport._count.gigHistory,
  }));
}
