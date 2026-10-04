CREATE TABLE "score_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"test_date" text NOT NULL,
	"reading_writing" integer,
	"math" integer,
	"domain_bands" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"skill_results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "score_reports" ADD CONSTRAINT "score_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "score_reports_user_idx" ON "score_reports" USING btree ("user_id","test_date");