-- Verify a restored database against the manifest captured at backup time.
--
-- Run against the TARGET after pg_restore:
--     psql "$TARGET_URL" -q -t -A -F'|' -f scripts/verify-restore.sql | sort > /tmp/fresh.txt
--     diff <(sort backups/<stamp>/rowcounts.txt) /tmp/fresh.txt
--
-- Any output from diff is a table whose row count differs. An empty diff is the
-- only acceptable result before cutting over.
SELECT format('SELECT %L AS t, count(*)::bigint AS n FROM %I.%I', c.relname, n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname
\gexec
