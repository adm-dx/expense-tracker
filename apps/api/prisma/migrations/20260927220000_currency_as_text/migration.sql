-- Currencies become an open list of ISO codes (validated by the API against
-- `CURRENCIES` in @expense-tracker/types), so the enum turns into TEXT.
-- Converted in place: Prisma's default plan would drop and recreate the column.
ALTER TABLE "transactions" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "currency" TYPE TEXT USING "currency"::TEXT;
ALTER TABLE "transactions" ALTER COLUMN "currency" SET DEFAULT 'RSD';

-- DropEnum
DROP TYPE "Currency";
