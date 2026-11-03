-- CreateEnum
CREATE TYPE "ReturnPolicy" AS ENUM ('RETURNABLE', 'NO_RETURN');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "occasionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "returnPolicy" "ReturnPolicy" NOT NULL DEFAULT 'RETURNABLE',
ADD COLUMN     "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
