-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RSD', 'EUR', 'HUF');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'RSD';
