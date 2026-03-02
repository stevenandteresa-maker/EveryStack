CREATE TABLE "base_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"platform" varchar(50) NOT NULL,
	"external_base_id" varchar(255),
	"external_base_name" varchar(255),
	"oauth_tokens" jsonb,
	"sync_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_direction" varchar(50) DEFAULT 'bidirectional' NOT NULL,
	"conflict_resolution" varchar(50) DEFAULT 'last_write_wins' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_status" varchar(50) DEFAULT 'active' NOT NULL,
	"health" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY NOT NULL,
	"table_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"field_type" varchar(50) NOT NULL,
	"field_sub_type" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"unique" boolean DEFAULT false NOT NULL,
	"read_only" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"default_value" jsonb,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"external_field_id" varchar(255),
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"table_type" varchar(50) DEFAULT 'table' NOT NULL,
	"tab_color" varchar(20),
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "base_connections" ADD CONSTRAINT "base_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "base_connections" ADD CONSTRAINT "base_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "base_connections_tenant_idx" ON "base_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "base_connections_tenant_platform_idx" ON "base_connections" USING btree ("tenant_id","platform");--> statement-breakpoint
CREATE INDEX "fields_tenant_table_env_idx" ON "fields" USING btree ("tenant_id","table_id","environment");--> statement-breakpoint
CREATE INDEX "fields_table_sort_idx" ON "fields" USING btree ("table_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "fields_table_external_idx" ON "fields" USING btree ("table_id","external_field_id") WHERE "fields"."external_field_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tables_tenant_workspace_idx" ON "tables" USING btree ("tenant_id","workspace_id");--> statement-breakpoint
CREATE INDEX "tables_workspace_env_idx" ON "tables" USING btree ("workspace_id","environment");