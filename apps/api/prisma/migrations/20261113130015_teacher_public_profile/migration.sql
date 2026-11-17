-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];
