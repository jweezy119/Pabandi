-- Canonical reliabilityScore: 0-100, one writer, one cold-start baseline.
--
-- WHY
--
-- `reliabilityScore` was written by seven different files across three scales:
--
--   0-1000   the column default (750) and every threshold in passport.service
--             (850/700/500/300) and passport-risk.service
--   0-100    crm-reliability.service, reliability.service's Elo path, the badge
--   0-5      reviewService, which wrote `(googleRating * 0.4) +
--             (completionRate * 0.6)` straight into the column
--
-- So the score a customer saw depended on which module happened to ask, and a
-- business with a flawless 5.0 Google rating stored `5.0` — which every 0-100
-- threshold read as the worst possible score. New accounts stored 750, which
-- the tier table read as GOLD and the badge rendered as the public string
-- "750/100".
--
-- The code now clamps on read as well as write (trust-core.service.ts), so this
-- migration is a correction rather than a dependency: rows outside 0-100 read
-- as 100 the moment the code deploys, and as 50 the moment this runs.
--
--
-- WHY EVERY BLOCK IS TABLE-EXISTENCE AWARE
--
-- The production database does not contain "CrmClient" or "CrmEmployee". No
-- migration in this repository creates them — `20260930_drop_crm_legacy_columns`
-- only drops indexes on a table it assumes exists — so `prisma migrate status`
-- reports everything as applied while `schema.prisma` describes two models the
-- database has never had. (That gap is pre-existing and is NOT this migration's
-- to fix; it is reported separately.)
--
-- An unguarded `ALTER TABLE "CrmClient"` aborts the whole transaction, including
-- the User backfill that has already run in it. Each block below therefore
-- checks for the table first and no-ops if it is absent, so this migration
-- succeeds on a database with the CRM tables and on one without them, and does
-- the same work in both cases.
--
--
-- WHAT THE BACKFILL DOES, AND WHAT IT DELIBERATELY DOES NOT
--
-- Rows above 100 are unambiguous — nothing on the canonical scale exceeds 100,
-- so any such value is a 0-1000 figure or a bad write, and is divided by ten.
--
-- The 750 rows are identified BEFORE any division, while 750 is still a
-- recognisable value. Every account created before this change that never went
-- through a scoring path holds exactly 750 — the schema default — regardless of
-- behaviour. Those rows carry no information: mapping them through the /10
-- would make them 75, implying an observed below-average reliability that
-- nobody ever measured. They are cold starts, and the cold-start value is 50.
--
-- Rows at or below 100 are left ALONE. They are already in range, and the value
-- alone cannot distinguish a correctly-written 0-100 score from a small number
-- off the 0-1000 scale (a "90" meaning bad). Rescaling those would corrupt
-- correct rows to fix a minority we cannot identify. They are re-derived by the
-- next ensemble recomputation — corrected from the signals rather than from a
-- guess about which scale wrote them.
--
-- Measured on production before this migration was written:
--   User         312 rows scored — 311 at the 750 default, 1 in the 76-100 band
--   CrmClient    table absent
--   CrmEmployee  table absent
--   Business     x20 applied only where a score is present
--
-- WHY NOT 0 FOR EVERYTHING
--
-- Zeroing every row would be simpler and wrong. It would destroy the information
-- that some accounts were tracked on the 0-100 scale and others were not, which
-- is exactly the distinction needed to interpret the rows that remain.

-- ─── User ────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('"User"') IS NOT NULL THEN
        ALTER TABLE "User" ALTER COLUMN "reliabilityScore" SET DEFAULT 50;

        -- Default-750 rows first, while 750 is still identifiable.
        UPDATE "User" SET "reliabilityScore" = 50 WHERE "reliabilityScore" = 750;

        -- Everything else above 100 is a 0-1000 figure written by a caller that
        -- assumed the wrong range. `> 100` cannot touch a correct 0-100 score.
        UPDATE "User"
        SET "reliabilityScore" = ROUND("reliabilityScore" / 10.0)::double precision
        WHERE "reliabilityScore" > 100;

        RAISE NOTICE 'User.reliabilityScore: default -> 50, 750 rows -> 50, >100 divided by ten';
    ELSE
        RAISE NOTICE 'User table absent; skipped.';
    END IF;
END $$;

-- ─── CrmClient ───────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('"CrmClient"') IS NOT NULL THEN
        ALTER TABLE "CrmClient" ALTER COLUMN "reliabilityScore" SET DEFAULT 50;

        UPDATE "CrmClient" SET "reliabilityScore" = 50 WHERE "reliabilityScore" = 750;

        UPDATE "CrmClient"
        SET "reliabilityScore" = ROUND("reliabilityScore" / 10.0)::double precision
        WHERE "reliabilityScore" > 100;

        RAISE NOTICE 'CrmClient.reliabilityScore: default -> 50, 750 rows -> 50, >100 divided by ten';
    ELSE
        RAISE NOTICE 'CrmClient table absent (pre-existing schema drift); skipped.';
    END IF;
END $$;

-- ─── CrmEmployee ─────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('"CrmEmployee"') IS NOT NULL THEN
        ALTER TABLE "CrmEmployee" ALTER COLUMN "reliabilityScore" SET DEFAULT 50;

        -- 100 was the top of the scale for an employee who had not started work.
        UPDATE "CrmEmployee" SET "reliabilityScore" = 50 WHERE "reliabilityScore" = 100;

        UPDATE "CrmEmployee"
        SET "reliabilityScore" = ROUND("reliabilityScore" / 10.0)::double precision
        WHERE "reliabilityScore" > 100;

        RAISE NOTICE 'CrmEmployee.reliabilityScore: default -> 50, 100 rows -> 50';
    ELSE
        RAISE NOTICE 'CrmEmployee table absent (pre-existing schema drift); skipped.';
    END IF;
END $$;

-- ─── Business ────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF to_regclass('"Business"') IS NOT NULL THEN
        -- The 0-5 blend -> the 0-100 scale. Exact, because the transform is
        -- known: reviewService was the only writer and it always wrote 0-5.
        UPDATE "Business"
        SET "reliabilityScore" = ROUND("reliabilityScore" * 20.0)::double precision
        WHERE "reliabilityScore" IS NOT NULL
          AND "reliabilityScore" <= 5;

        RAISE NOTICE 'Business.reliabilityScore: 0-5 blends rescaled to 0-100';
    ELSE
        RAISE NOTICE 'Business table absent; skipped.';
    END IF;
END $$;