-- Add rotated_at and revoked_at columns to refresh_tokens
-- These were missing from the initial db push that preceded the migration tracking setup
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "rotated_at" TIMESTAMP(3);
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3);
