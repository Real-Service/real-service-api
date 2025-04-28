-- Add timeline fields to quotes table
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "preferred_start_date" TIMESTAMP;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "estimated_duration" INTEGER DEFAULT 1;

-- Add additional fields for terms & conditions, discount, and tax
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "terms_and_conditions" TEXT;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "tax" DOUBLE PRECISION DEFAULT 0;