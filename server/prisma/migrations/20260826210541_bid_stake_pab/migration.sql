DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ProjectBid') THEN
    ALTER TABLE "ProjectBid" ADD COLUMN "stakePab" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END
$$;
