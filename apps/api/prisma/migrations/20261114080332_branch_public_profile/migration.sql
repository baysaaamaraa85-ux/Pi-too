-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "description" TEXT,
ADD COLUMN     "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "photo_url" TEXT;
