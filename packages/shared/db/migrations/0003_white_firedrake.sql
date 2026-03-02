CREATE TABLE "cross_link_index" (
	"tenant_id" uuid NOT NULL,
	"cross_link_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"source_table_id" uuid NOT NULL,
	"target_record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_link_index_pkey" PRIMARY KEY("tenant_id","cross_link_id","source_record_id","target_record_id")
);
--> statement-breakpoint
CREATE TABLE "cross_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255),
	"source_table_id" uuid NOT NULL,
	"source_field_id" uuid NOT NULL,
	"target_table_id" uuid NOT NULL,
	"target_display_field_id" uuid NOT NULL,
	"relationship_type" varchar(20) NOT NULL,
	"reverse_field_id" uuid,
	"link_scope_filter" jsonb,
	"card_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_links_per_record" integer DEFAULT 50 NOT NULL,
	"max_depth" integer DEFAULT 3 NOT NULL,
	"environment" varchar(20) DEFAULT 'live' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "records" (
	"tenant_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"canonical_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sync_metadata" jsonb,
	"search_vector" "tsvector",
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "records_pkey" PRIMARY KEY("tenant_id","id")
) PARTITION BY HASH (tenant_id);
--> statement-breakpoint
CREATE TABLE records_p0 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE records_p1 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 1);
CREATE TABLE records_p2 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 2);
CREATE TABLE records_p3 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 3);
CREATE TABLE records_p4 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 4);
CREATE TABLE records_p5 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 5);
CREATE TABLE records_p6 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 6);
CREATE TABLE records_p7 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 7);
CREATE TABLE records_p8 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 8);
CREATE TABLE records_p9 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 9);
CREATE TABLE records_p10 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 10);
CREATE TABLE records_p11 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 11);
CREATE TABLE records_p12 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 12);
CREATE TABLE records_p13 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 13);
CREATE TABLE records_p14 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 14);
CREATE TABLE records_p15 PARTITION OF records FOR VALUES WITH (MODULUS 16, REMAINDER 15);
--> statement-breakpoint
ALTER TABLE "cross_link_index" ADD CONSTRAINT "cross_link_index_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_link_index" ADD CONSTRAINT "cross_link_index_cross_link_id_cross_links_id_fk" FOREIGN KEY ("cross_link_id") REFERENCES "public"."cross_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_link_index" ADD CONSTRAINT "cross_link_index_source_table_id_tables_id_fk" FOREIGN KEY ("source_table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_source_table_id_tables_id_fk" FOREIGN KEY ("source_table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_source_field_id_fields_id_fk" FOREIGN KEY ("source_field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_target_table_id_tables_id_fk" FOREIGN KEY ("target_table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_target_display_field_id_fields_id_fk" FOREIGN KEY ("target_display_field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_reverse_field_id_fields_id_fk" FOREIGN KEY ("reverse_field_id") REFERENCES "public"."fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_links" ADD CONSTRAINT "cross_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cross_link_index_target_idx" ON "cross_link_index" USING btree ("tenant_id","target_record_id","cross_link_id");--> statement-breakpoint
CREATE INDEX "cross_link_index_source_idx" ON "cross_link_index" USING btree ("tenant_id","source_record_id","cross_link_id");--> statement-breakpoint
CREATE INDEX "cross_links_tenant_idx" ON "cross_links" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "cross_links_source_table_idx" ON "cross_links" USING btree ("source_table_id");--> statement-breakpoint
CREATE INDEX "cross_links_target_table_idx" ON "cross_links" USING btree ("target_table_id");--> statement-breakpoint
CREATE INDEX "records_tenant_table_deleted_idx" ON "records" USING btree ("tenant_id","table_id","deleted_at");--> statement-breakpoint
CREATE INDEX "records_tenant_id_idx" ON "records" USING btree ("tenant_id","id");