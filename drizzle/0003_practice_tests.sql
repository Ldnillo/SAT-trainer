CREATE TABLE "practice_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"modules" jsonb NOT NULL,
	"scores" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "test_answers" (
	"practice_test_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"correct" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_answers_practice_test_id_question_id_pk" PRIMARY KEY("practice_test_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ALTER COLUMN "practice_set_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "practice_test_id" uuid;--> statement-breakpoint
ALTER TABLE "practice_tests" ADD CONSTRAINT "practice_tests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_practice_test_id_practice_tests_id_fk" FOREIGN KEY ("practice_test_id") REFERENCES "public"."practice_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_tests_user_idx" ON "practice_tests" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_practice_test_id_practice_tests_id_fk" FOREIGN KEY ("practice_test_id") REFERENCES "public"."practice_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_test_question_idx" ON "attempts" USING btree ("practice_test_id","question_id");