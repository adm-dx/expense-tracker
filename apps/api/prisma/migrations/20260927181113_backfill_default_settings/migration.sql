-- Every user gets a settings row with the defaults (DEFAULT_USER_SETTINGS in
-- @expense-tracker/types as of this migration); new users get one on
-- registration. Rows a user already saved are left alone.
INSERT INTO "user_settings" ("userId", "settings", "createdAt", "updatedAt")
SELECT
  u."id",
  '{"theme": "system", "colorScheme": "slate", "currency": "RSD", "location": {"mode": "manual", "name": "Belgrade, RS", "lat": 44.82, "lon": 20.46}}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
ON CONFLICT ("userId") DO NOTHING;
