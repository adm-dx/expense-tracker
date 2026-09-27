-- EUR becomes the default currency, and new users start with it alone.
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- Settings stored before `currencies` existed would now read as ["EUR"],
-- losing RSD and HUF (and a display currency of RSD or HUF). Give them the
-- list they had until now.
UPDATE "user_settings"
SET "settings" = "settings" || '{"currencies":["RSD","EUR","HUF"]}'::jsonb
WHERE NOT ("settings" ? 'currencies');
