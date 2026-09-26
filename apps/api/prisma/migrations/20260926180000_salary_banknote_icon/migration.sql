-- Data migration: the default Salary category now uses the banknote icon
-- (see src/modules/categories/default-categories.ts). Only rows that still have
-- the old default are touched, so an icon a user picked is kept.
UPDATE "categories" SET "icon" = 'banknote', "updatedAt" = NOW()
WHERE "name" = 'Salary' AND "icon" = 'wallet';
