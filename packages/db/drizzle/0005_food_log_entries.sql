CREATE TABLE "food_log_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"pantry_item_id" uuid,
	"pantry_item_type" "pantry_item_type" NOT NULL,
	"display_name" text NOT NULL,
	"icon_key" text NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"consumed_date" date NOT NULL,
	"serving_kind" text NOT NULL,
	"serving_unit_key" text,
	"serving_custom_label" text,
	"quantity" double precision NOT NULL,
	"calories" double precision NOT NULL,
	"protein_grams" double precision NOT NULL,
	"fat_grams" double precision NOT NULL,
	"carbohydrates_grams" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_log_entries" ADD CONSTRAINT "food_log_entries_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_log_entries_owner_date_time_idx" ON "food_log_entries" USING btree ("owner_user_id","consumed_date","consumed_at","id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "food_log_entries_owner_pantry_item_idx" ON "food_log_entries" USING btree ("owner_user_id","pantry_item_id");
