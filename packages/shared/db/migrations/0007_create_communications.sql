CREATE TABLE "thread_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid,
	"author_type" varchar(50) DEFAULT 'user' NOT NULL,
	"message_type" varchar(50) DEFAULT 'message' NOT NULL,
	"content" jsonb NOT NULL,
	"parent_message_id" uuid,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reactions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pinned_at" timestamp with time zone,
	"pinned_by" uuid,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_read_at" timestamp with time zone,
	"muted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"scope_type" varchar(50) NOT NULL,
	"scope_id" uuid NOT NULL,
	"visibility" varchar(50) DEFAULT 'internal' NOT NULL,
	"name" varchar(255),
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_saved_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"note" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_parent_message_id_thread_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."thread_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_messages" ADD CONSTRAINT "user_saved_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_messages" ADD CONSTRAINT "user_saved_messages_message_id_thread_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."thread_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_messages" ADD CONSTRAINT "user_saved_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "thread_messages_thread_created_idx" ON "thread_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "thread_messages_thread_parent_idx" ON "thread_messages" USING btree ("thread_id","parent_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_participants_thread_user_idx" ON "thread_participants" USING btree ("thread_id","user_id");--> statement-breakpoint
CREATE INDEX "thread_participants_user_idx" ON "thread_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_tenant_scope_idx" ON "threads" USING btree ("tenant_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "threads_tenant_scope_type_idx" ON "threads" USING btree ("tenant_id","scope_type");--> statement-breakpoint
CREATE INDEX "user_saved_messages_user_saved_idx" ON "user_saved_messages" USING btree ("user_id","saved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_saved_messages_user_message_idx" ON "user_saved_messages" USING btree ("user_id","message_id");