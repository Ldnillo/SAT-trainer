CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text,
	"section" text NOT NULL,
	"domain" text NOT NULL,
	"skill" text NOT NULL,
	"difficulty" text NOT NULL,
	"format" text NOT NULL,
	"status" text NOT NULL,
	"content" jsonb NOT NULL,
	"validation_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification" jsonb,
	"provenance" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "questions_skill_difficulty_status_idx" ON "questions" USING btree ("skill","difficulty","status");--> statement-breakpoint
CREATE INDEX "questions_domain_idx" ON "questions" USING btree ("domain");