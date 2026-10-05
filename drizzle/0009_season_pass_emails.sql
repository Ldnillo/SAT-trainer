ALTER TABLE "season_passes" ADD COLUMN "receipt_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "season_passes" ADD COLUMN "reminder_sent_at" timestamp with time zone;