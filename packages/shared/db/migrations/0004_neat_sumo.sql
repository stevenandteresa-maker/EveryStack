CREATE TABLE "record_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(50),
	"color" varchar(20),
	"canonical_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"linked_records" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"available_in" varchar(50)[] DEFAULT '{all}' NOT NULL,
	"section_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"publish_state" varchar(20) DEFAULT 'live' NOT NULL,
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "record_view_configs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"layout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"context" varchar(50) NOT NULL,
	"context_parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_view_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"view_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"view_type" varchar(50) DEFAULT 'grid' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_shared" boolean DEFAULT true NOT NULL,
	"publish_state" varchar(20) DEFAULT 'live' NOT NULL,
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "record_templates" ADD CONSTRAINT "record_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_templates" ADD CONSTRAINT "record_templates_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_templates" ADD CONSTRAINT "record_templates_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_templates" ADD CONSTRAINT "record_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_view_configs" ADD CONSTRAINT "record_view_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_view_configs" ADD CONSTRAINT "record_view_configs_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_view_configs" ADD CONSTRAINT "record_view_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_view_preferences" ADD CONSTRAINT "user_view_preferences_view_id_views_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_view_preferences" ADD CONSTRAINT "user_view_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "record_templates_tenant_table_env_idx" ON "record_templates" USING btree ("tenant_id","table_id","environment");--> statement-breakpoint
CREATE INDEX "record_templates_tenant_table_state_idx" ON "record_templates" USING btree ("tenant_id","table_id","publish_state");--> statement-breakpoint
CREATE UNIQUE INDEX "record_templates_tenant_table_default_idx" ON "record_templates" USING btree ("tenant_id","table_id") WHERE "record_templates"."is_default" = true;--> statement-breakpoint
CREATE INDEX "record_view_configs_tenant_table_idx" ON "record_view_configs" USING btree ("tenant_id","table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "record_view_configs_tenant_table_default_idx" ON "record_view_configs" USING btree ("tenant_id","table_id") WHERE "record_view_configs"."is_default" = true;--> statement-breakpoint
CREATE INDEX "sections_tenant_context_parent_idx" ON "sections" USING btree ("tenant_id","context","context_parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_view_preferences_view_user_idx" ON "user_view_preferences" USING btree ("view_id","user_id");--> statement-breakpoint
CREATE INDEX "views_tenant_table_env_idx" ON "views" USING btree ("tenant_id","table_id","environment");--> statement-breakpoint
CREATE INDEX "views_table_position_idx" ON "views" USING btree ("table_id","position");