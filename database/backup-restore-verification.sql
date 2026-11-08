SELECT COUNT(*) AS restored_table_count FROM pg_tables WHERE schemaname IN ('marketplace','gateway');
SELECT COUNT(*) AS restored_users FROM marketplace."User";
