-- Phase 1I: Make actor_id nullable for system actor type (actor_type = 'system')
-- The audit-log spec requires actor_id to be null for system-initiated actions.
ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
