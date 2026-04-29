CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_pantry_item_id" uuid NOT NULL,
	"ingredient_food_pantry_item_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"serving_kind" text NOT NULL,
	"serving_unit_key" text,
	"serving_custom_label" text,
	"quantity" double precision NOT NULL,
	CONSTRAINT "recipe_ingredients_serving_kind_chk" CHECK ("serving_kind" IN ('base', 'unit', 'custom'))
);
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("recipe_pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_food_pantry_item_id_pantry_items_id_fk" FOREIGN KEY ("ingredient_food_pantry_item_id") REFERENCES "public"."pantry_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_sort_idx" ON "recipe_ingredients" USING btree ("recipe_pantry_item_id","sort_order");
