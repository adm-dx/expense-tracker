-- Data migration: give every existing user the default category set that new
-- users receive on registration (see src/modules/categories/default-categories.ts,
-- keep both lists in sync). Idempotent: names a user already has are skipped.
INSERT INTO "categories" ("id", "userId", "name", "color", "icon", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", d."name", d."color", d."icon", NOW(), NOW()
FROM "users" u
CROSS JOIN (
  VALUES
    ('Food', '#F97316', 'utensils'),
    ('Transport', '#3B82F6', 'car'),
    ('Housing', '#8B5CF6', 'house'),
    ('Entertainment', '#EC4899', 'clapperboard'),
    ('Health', '#EF4444', 'heart-pulse'),
    ('Shopping', '#EAB308', 'shopping-bag'),
    ('Salary', '#22C55E', 'wallet'),
    ('Other', '#64748B', 'circle-ellipsis')
) AS d("name", "color", "icon")
ON CONFLICT ("userId", "name") DO NOTHING;
