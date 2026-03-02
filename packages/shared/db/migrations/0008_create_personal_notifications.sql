CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"source_thread_id" uuid,
	"source_message_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" varchar(500),
	"notes" text,
	"color" varchar(50),
	"show_as" varchar(20) DEFAULT 'busy' NOT NULL,
	"recurrence_rule" jsonb,
	"reminder_minutes" integer[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"due_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"parent_task_id" uuid,
	"linked_record_id" uuid,
	"linked_tenant_id" uuid
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_parent_task_id_user_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."user_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_tenant_idx" ON "notifications" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "user_events_user_time_idx" ON "user_events" USING btree ("user_id","start_time","end_time");--> statement-breakpoint
CREATE INDEX "user_events_user_all_day_idx" ON "user_events" USING btree ("user_id","all_day");--> statement-breakpoint
CREATE UNIQUE INDEX "user_notification_preferences_user_tenant_idx" ON "user_notification_preferences" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "user_tasks_user_completed_idx" ON "user_tasks" USING btree ("user_id","completed");--> statement-breakpoint
CREATE INDEX "user_tasks_user_due_date_idx" ON "user_tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "user_tasks_parent_idx" ON "user_tasks" USING btree ("parent_task_id");