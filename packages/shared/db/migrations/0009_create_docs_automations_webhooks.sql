CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"automation_id" uuid NOT NULL,
	"trigger_record_id" uuid,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"step_log" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"trigger" jsonb NOT NULL,
	"steps" jsonb[] NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"error_count" integer DEFAULT 0 NOT NULL,
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"file_url" varchar(2048) NOT NULL,
	"file_type" varchar(20) DEFAULT 'pdf' NOT NULL,
	"generated_by" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"automation_run_id" uuid,
	"ai_drafted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"webhook_endpoint_id" uuid NOT NULL,
	"event" varchar(64) NOT NULL,
	"delivery_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"url" varchar(2048) NOT NULL,
	"signing_secret" varchar(64) NOT NULL,
	"subscribed_events" text[] NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automations" ADD CONSTRAINT "automations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_documents" ADD CONSTRAINT "generated_documents_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_log" ADD CONSTRAINT "webhook_delivery_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_log" ADD CONSTRAINT "webhook_delivery_log_webhook_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automation_runs_automation_started_idx" ON "automation_runs" USING btree ("automation_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "automations_tenant_workspace_env_idx" ON "automations" USING btree ("tenant_id","workspace_id","environment");--> statement-breakpoint
CREATE INDEX "automations_tenant_status_idx" ON "automations" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "document_templates_tenant_table_idx" ON "document_templates" USING btree ("tenant_id","table_id");--> statement-breakpoint
CREATE INDEX "generated_documents_tenant_template_idx" ON "generated_documents" USING btree ("tenant_id","template_id");--> statement-breakpoint
CREATE INDEX "generated_documents_tenant_record_idx" ON "generated_documents" USING btree ("tenant_id","source_record_id");--> statement-breakpoint
CREATE INDEX "webhook_delivery_log_endpoint_created_idx" ON "webhook_delivery_log" USING btree ("tenant_id","webhook_endpoint_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "webhook_delivery_log_tenant_status_idx" ON "webhook_delivery_log" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_tenant_workspace_idx" ON "webhook_endpoints" USING btree ("tenant_id","workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_tenant_status_idx" ON "webhook_endpoints" USING btree ("tenant_id","status");