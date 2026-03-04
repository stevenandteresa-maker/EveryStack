-- Migration: Update thread_participants for external contact support
-- Adds participant_type, external_contact_id, makes user_id nullable

-- Add participant_type column
ALTER TABLE "thread_participants"
  ADD COLUMN "participant_type" varchar(50) NOT NULL DEFAULT 'user';

-- Make user_id nullable (drop NOT NULL constraint)
ALTER TABLE "thread_participants"
  ALTER COLUMN "user_id" DROP NOT NULL;

-- Add external_contact_id column (no FK — referenced table does not exist yet)
ALTER TABLE "thread_participants"
  ADD COLUMN "external_contact_id" uuid;

-- At least one identity must be present
ALTER TABLE "thread_participants"
  ADD CONSTRAINT "thread_participants_identity_check"
  CHECK ("user_id" IS NOT NULL OR "external_contact_id" IS NOT NULL);
