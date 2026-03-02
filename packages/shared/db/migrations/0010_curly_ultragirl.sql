CREATE TABLE "ai_credit_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"credits_total" integer NOT NULL,
	"credits_used" numeric(10, 2) DEFAULT '0' NOT NULL,
	"credits_remaining" numeric(10, 2) GENERATED ALWAYS AS (credits_total - credits_used) STORED,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"feature" varchar(64) NOT NULL,
	"model" varchar(32),
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_input" integer DEFAULT 0,
	"cost_usd" numeric(10, 6),
	"credits_charged" numeric(10, 2),
	"status" varchar(20) NOT NULL,
	"duration_ms" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_log_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "ai_usage_log_y2026m03" PARTITION OF "ai_usage_log"
	FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--> statement-breakpoint
CREATE TABLE "ai_usage_log_y2026m04" PARTITION OF "ai_usage_log"
	FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
--> statement-breakpoint
CREATE TABLE "ai_usage_log_y2026m05" PARTITION OF "ai_usage_log"
	FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"scopes" text[] NOT NULL,
	"rate_limit_tier" varchar(32) DEFAULT 'standard' NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_log" (
	"id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"method" varchar(8) NOT NULL,
	"path" varchar(512) NOT NULL,
	"status_code" integer NOT NULL,
	"duration_ms" integer,
	"request_size" integer,
	"response_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_request_log_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "api_request_log_y2026m03" PARTITION OF "api_request_log"
	FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--> statement-breakpoint
CREATE TABLE "api_request_log_y2026m04" PARTITION OF "api_request_log"
	FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
--> statement-breakpoint
CREATE TABLE "api_request_log_y2026m05" PARTITION OF "api_request_log"
	FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_type" varchar(32) NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_label" varchar(255),
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trace_id" varchar(255),
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_id_created_at_pk" PRIMARY KEY("id","created_at")
) PARTITION BY RANGE ("created_at");
--> statement-breakpoint
CREATE TABLE "audit_log_y2026m03" PARTITION OF "audit_log"
	FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
--> statement-breakpoint
CREATE TABLE "audit_log_y2026m04" PARTITION OF "audit_log"
	FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
--> statement-breakpoint
CREATE TABLE "audit_log_y2026m05" PARTITION OF "audit_log"
	FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
--> statement-breakpoint
CREATE TABLE "command_bar_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_set" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_suggestions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(64),
	"user_priority" varchar(32),
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_recent_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" varchar(64) NOT NULL,
	"item_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_log" ADD CONSTRAINT "api_request_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_log" ADD CONSTRAINT "api_request_log_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_bar_sessions" ADD CONSTRAINT "command_bar_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_bar_sessions" ADD CONSTRAINT "command_bar_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_suggestions" ADD CONSTRAINT "feature_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_suggestions" ADD CONSTRAINT "feature_suggestions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_votes" ADD CONSTRAINT "feature_votes_suggestion_id_feature_suggestions_id_fk" FOREIGN KEY ("suggestion_id") REFERENCES "public"."feature_suggestions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_votes" ADD CONSTRAINT "feature_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recent_items" ADD CONSTRAINT "user_recent_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recent_items" ADD CONSTRAINT "user_recent_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_ledger_tenant_period_idx" ON "ai_credit_ledger" USING btree ("tenant_id","period_start");--> statement-breakpoint
CREATE INDEX "ai_usage_log_tenant_created_idx" ON "ai_usage_log" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_usage_log_tenant_feature_idx" ON "ai_usage_log" USING btree ("tenant_id","feature");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_request_log_tenant_key_created_idx" ON "api_request_log" USING btree ("tenant_id","api_key_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_tenant_created_idx" ON "audit_log" USING btree ("tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_tenant_entity_idx" ON "audit_log" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_actor_idx" ON "audit_log" USING btree ("tenant_id","actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "command_bar_sessions_user_tenant_created_idx" ON "command_bar_sessions" USING btree ("user_id","tenant_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "feature_suggestions_tenant_status_idx" ON "feature_suggestions" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "feature_suggestions_tenant_votes_idx" ON "feature_suggestions" USING btree ("tenant_id","vote_count" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "feature_votes_suggestion_user_idx" ON "feature_votes" USING btree ("suggestion_id","user_id");--> statement-breakpoint
CREATE INDEX "user_recent_items_user_tenant_accessed_idx" ON "user_recent_items" USING btree ("user_id","tenant_id","accessed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_recent_items_user_item_idx" ON "user_recent_items" USING btree ("user_id","item_type","item_id");