-- Retire the Ondo USDY rent-yield rail.
--
-- WHY: USDY is a tokenized US Treasury product. Its return is interest on
-- government debt — i.e. a fixed, guaranteed return accruing by the passage of
-- time. That is Riba, and it is incompatible with the halal/Sharia-compliant
-- positioning Pabandi now enforces across every vertical. The rail is replaced
-- by halal profit-sharing structures (Musharakah / Mudarabah / Murabahah) whose
-- returns must trace to real economic activity.
--
-- This migration is deliberately conservative, idempotent and DEFENSIVE:
--   1. Drop the marketing lead-capture table for the retired rail (IF EXISTS).
--   2. Re-point existing rows off the retired riba-bearing pool names onto the
--      halal structures, so no UI or API surfaces a dead/invalid pool value.
--   3. Align column defaults with the new halal defaults.
--
-- It does NOT drop RentStream / YieldAgreement / RenterEquityWallet — those
-- tables carry the (still-valid) profit-sharing mechanic and are retained.
--
-- IMPORTANT: `YieldAgreement` is NOT created by a Prisma migration — it is
-- created by raw SQL at runtime (see server/src/routes/linkedinSeed.routes.ts).
-- It therefore may not exist in every environment. All statements touching it
-- are wrapped in existence checks so `prisma migrate deploy` can never fail on
-- a missing table and block the deploy.

-- 1. Drop the USDY pre-registration lead table (safe if absent).
DROP TABLE IF EXISTS "UsdyLead";

-- 2. Re-point existing pool values off the retired riba-bearing instruments.
--    Guarded: only runs when the table actually exists.
DO $$
BEGIN
  IF to_regclass('"RentStream"') IS NOT NULL THEN
    UPDATE "RentStream"
       SET "pool" = 'MUSHARAKAH'
     WHERE "pool" IN ('ONDO_USDC', 'JITO_STSOL', 'MAPLE');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"YieldAgreement"') IS NOT NULL THEN
    UPDATE "YieldAgreement"
       SET "pool" = 'MUSHARAKAH'
     WHERE "pool" IN ('ONDO_USDC', 'JITO_STSOL', 'MAPLE');
  END IF;
END $$;

-- 3. Align defaults with the halal profit-sharing structures.
DO $$
BEGIN
  IF to_regclass('"RentStream"') IS NOT NULL THEN
    ALTER TABLE "RentStream" ALTER COLUMN "pool" SET DEFAULT 'MUSHARAKAH';
    ALTER TABLE "RentStream" ALTER COLUMN "expectedApy" SET DEFAULT 5.0;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"YieldAgreement"') IS NOT NULL THEN
    ALTER TABLE "YieldAgreement" ALTER COLUMN "pool" SET DEFAULT 'MUSHARAKAH';
    ALTER TABLE "YieldAgreement" ALTER COLUMN "expectedApy" SET DEFAULT 5.0;
    ALTER TABLE "YieldAgreement" ALTER COLUMN "tenantApy" SET DEFAULT 4.0;
  END IF;
END $$;
