CREATE TYPE "public"."reference_food_import_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "reference_food_import_keys" (
	"import_run_id" uuid NOT NULL,
	"source_food_id" text NOT NULL,
	CONSTRAINT "reference_food_import_keys_import_run_id_source_food_id_pk" PRIMARY KEY("import_run_id","source_food_id")
);
--> statement-breakpoint
CREATE TABLE "reference_food_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_version" text NOT NULL,
	"file_hash" text NOT NULL,
	"records_read" integer DEFAULT 0 NOT NULL,
	"records_upserted" integer DEFAULT 0 NOT NULL,
	"records_skipped_invalid" integer DEFAULT 0 NOT NULL,
	"records_deactivated" integer DEFAULT 0 NOT NULL,
	"status" "reference_food_import_run_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error_summary" text
);
--> statement-breakpoint
ALTER TABLE "reference_foods" ADD COLUMN "food_class" text;--> statement-breakpoint
ALTER TABLE "reference_foods" ADD COLUMN "servings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_foods" ADD COLUMN "raw_nutrients" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_foods" ADD COLUMN "raw_payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reference_food_import_keys" ADD CONSTRAINT "reference_food_import_keys_import_run_id_reference_food_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."reference_food_import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reference_food_import_keys_import_run_id_idx" ON "reference_food_import_keys" USING btree ("import_run_id");--> statement-breakpoint
CREATE INDEX "reference_food_import_runs_source_started_at_idx" ON "reference_food_import_runs" USING btree ("source","started_at");