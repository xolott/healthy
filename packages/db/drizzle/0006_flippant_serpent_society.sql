CREATE TYPE "public"."food_log_entry_item_source" AS ENUM('pantry', 'reference_food');--> statement-breakpoint
CREATE TABLE "reference_foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"source_food_id" text NOT NULL,
	"display_name" text NOT NULL,
	"brand" text,
	"base_amount_grams" double precision NOT NULL,
	"calories" double precision NOT NULL,
	"protein_grams" double precision NOT NULL,
	"fat_grams" double precision NOT NULL,
	"carbohydrates_grams" double precision NOT NULL,
	"icon_key" text DEFAULT 'food_bowl' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reference_foods_source_source_food_id_uidx" ON "reference_foods" USING btree ("source","source_food_id");--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD COLUMN "item_source" "food_log_entry_item_source" DEFAULT 'pantry' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entries" ALTER COLUMN "pantry_item_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD COLUMN "reference_food_id" uuid;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD COLUMN "reference_food_source" text;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD COLUMN "reference_source_food_id" text;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_reference_food_id_reference_foods_id_fk" FOREIGN KEY ("reference_food_id") REFERENCES "public"."reference_foods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_item_source_consistency_ck" CHECK (
  (item_source = 'pantry' AND pantry_item_id IS NOT NULL AND reference_food_id IS NULL AND pantry_item_type IS NOT NULL)
  OR
  (item_source = 'reference_food' AND reference_food_id IS NOT NULL AND pantry_item_id IS NULL AND pantry_item_type IS NULL)
);
