CREATE TABLE "change_feed_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "change_feed_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"xid" xid8 DEFAULT pg_current_xact_id() NOT NULL,
	"area" text NOT NULL,
	"organization_unit_id" uuid,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_change_feed_entries_xid" ON "change_feed_entries" ("xid");--> statement-breakpoint
CREATE INDEX "idx_change_feed_entries_created_at" ON "change_feed_entries" ("created_at");