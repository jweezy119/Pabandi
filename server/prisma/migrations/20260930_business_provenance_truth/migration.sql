-- ══════════════════════════════════════════════════════════════════════════════
-- Make "verified" and "claimed" mean what they say
--
-- Context
--   Every imported business (1503 OpenStreetMap, 62 + 27 others) was carrying
--   isVerified = true and isClaimed = true while having no owner at all.
--
--   Both flags were false claims:
--
--     • "verified" — the platform had never spoken to these businesses. An
--       OpenStreetMap row proves a place exists at a coordinate; it says nothing
--       about who runs it or whether they can take bookings. On a platform whose
--       entire proposition is verified trust, showing a verified badge here is
--       the most damaging possible default.
--
--     • "claimed" — this one also broke the product. business.controller's
--       claimBusiness rejects when `isClaimed || ownerId` is set, so a listing
--       that arrived already flagged claimed could *never* be claimed by the
--       owner. All 1503 imports were permanently unclaimable: the entire
--       supply-side growth path was dead, and an owner searching for their own
--       business would be told it was already taken by nobody.
--
--   The invariant restored here: a business is claimed if and only if it has an
--   owner. Verification is only ever earned through a real verification flow,
--   which is a separate concern from provenance.
--
--   Note the OFFLINE_SEED rows were unverified in the previous migration; they
--   also carried isClaimed = true and are corrected by the same rule.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Claimed ⟺ owned ──────────────────────────────────────────────────────────
-- An ownerless listing is by definition unclaimed, and must be claimable.
UPDATE "Business"
   SET "isClaimed" = false
 WHERE "ownerId" IS NULL
   AND "isClaimed" = true;

-- Belt and braces: a row with an owner is claimed even if the flag drifted.
UPDATE "Business"
   SET "isClaimed" = true
 WHERE "ownerId" IS NOT NULL
   AND "isClaimed" = false;

-- ── Verification is earned, never inherited from an import ───────────────────
-- No owner means no verification conversation could have happened.
UPDATE "Business"
   SET "isVerified" = false,
       "verifiedAt" = NULL
 WHERE "ownerId" IS NULL
   AND "isVerified" = true;

-- ── Record why we believe the business exists ─────────────────────────────────
-- Provenance is preserved (and made explicit) so discovery can still tell a
-- user "listed via OpenStreetMap" rather than pretending to nothing, while the
-- trust badges stay honest.
UPDATE "Business"
   SET "externalDetails" = COALESCE("externalDetails", '{}'::jsonb)
       || jsonb_build_object('verificationState', 'unverified')
       || jsonb_build_object(
            'listedVia', COALESCE("externalDetails"->>'source', 'unknown')
          )
 WHERE "ownerId" IS NULL
   AND COALESCE("externalDetails"->>'verificationState', '') IS DISTINCT FROM 'unverified';
