-- dashboardTheme is a DashboardTheme OBJECT, not a string.
--
-- ModularDashboard.tsx saves `{ accentColor, bannerColor, density, borderRadius }`
-- and settings.service.ts reads it back with `?? {}`, so the String column could
-- only ever hold a value nothing consumed. Every PUT /settings/dashboard-layout
-- failed Prisma validation and returned 500.
--
-- Existing rows held the bare string 'light' (the old column default). Each is
-- wrapped as JSON rather than dropped, so nothing stored is lost.
--
-- Written to be re-runnable: every branch reads the column THROUGH ::text, so the
-- same statement applied to an already-migrated table converges instead of
-- double-encoding. `prisma migrate deploy` runs a migration once, but a statement
-- that corrupts on a retry is a trap for anyone applying it by hand.
--
-- to_jsonb, not to_json: Prisma maps `Json` to jsonb, and a CASE mixing json and
-- jsonb branches fails with 42846.

ALTER TABLE "BusinessSettings"
  ALTER COLUMN "dashboardTheme" TYPE JSONB
  USING CASE
    WHEN "dashboardTheme" IS NULL THEN NULL::jsonb
    WHEN btrim("dashboardTheme"::text) IN ('', 'null', '"null"') THEN NULL::jsonb
    WHEN btrim("dashboardTheme"::text) ~ '^[[:space:]]*[{\[]' THEN btrim("dashboardTheme"::text)::jsonb
    ELSE to_jsonb(btrim(btrim("dashboardTheme"::text), '"'))
  END;
