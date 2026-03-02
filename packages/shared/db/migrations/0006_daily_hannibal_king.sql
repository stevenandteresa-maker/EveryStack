CREATE TABLE "sync_conflicts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"local_value" jsonb,
	"remote_value" jsonb,
	"base_value" jsonb,
	"platform" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_failures" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"base_connection_id" uuid NOT NULL,
	"record_id" uuid,
	"direction" varchar(20) NOT NULL,
	"error_code" varchar(50) NOT NULL,
	"error_message" text,
	"platform_record_id" varchar(255),
	"payload" jsonb,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sync_schema_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"base_connection_id" uuid NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"field_id" uuid,
	"platform_field_id" varchar(255) NOT NULL,
	"old_schema" jsonb,
	"new_schema" jsonb,
	"impact" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "synced_field_mappings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"base_connection_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"external_field_id" varchar(255) NOT NULL,
	"external_field_type" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_conflicts" ADD CONSTRAINT "sync_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_base_connection_id_base_connections_id_fk" FOREIGN KEY ("base_connection_id") REFERENCES "public"."base_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_failures" ADD CONSTRAINT "sync_failures_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_schema_changes" ADD CONSTRAINT "sync_schema_changes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_schema_changes" ADD CONSTRAINT "sync_schema_changes_base_connection_id_base_connections_id_fk" FOREIGN KEY ("base_connection_id") REFERENCES "public"."base_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_schema_changes" ADD CONSTRAINT "sync_schema_changes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_field_mappings" ADD CONSTRAINT "synced_field_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_field_mappings" ADD CONSTRAINT "synced_field_mappings_base_connection_id_base_connections_id_fk" FOREIGN KEY ("base_connection_id") REFERENCES "public"."base_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_field_mappings" ADD CONSTRAINT "synced_field_mappings_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_field_mappings" ADD CONSTRAINT "synced_field_mappings_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_conflicts_tenant_status_idx" ON "sync_conflicts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "sync_conflicts_record_idx" ON "sync_conflicts" USING btree ("record_id");--> statement-breakpoint
CREATE INDEX "sync_failures_tenant_connection_status_idx" ON "sync_failures" USING btree ("tenant_id","base_connection_id","status");--> statement-breakpoint
CREATE INDEX "sync_failures_tenant_status_idx" ON "sync_failures" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "sync_schema_changes_tenant_connection_status_idx" ON "sync_schema_changes" USING btree ("tenant_id","base_connection_id","status");--> statement-breakpoint
CREATE INDEX "synced_field_mappings_tenant_connection_idx" ON "synced_field_mappings" USING btree ("tenant_id","base_connection_id");--> statement-breakpoint
CREATE INDEX "synced_field_mappings_field_idx" ON "synced_field_mappings" USING btree ("field_id");