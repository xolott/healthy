CREATE TYPE "public"."pantry_item_type" AS ENUM('food', 'recipe');--> statement-breakpoint
CREATE TABLE "nutrients" (
	"key" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"canonical_unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"item_type" "pantry_item_type" NOT NULL,
	"name" text NOT NULL,
	"icon_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nutrients_canonical_unit_idx" ON "nutrients" USING btree ("canonical_unit");--> statement-breakpoint
CREATE INDEX "pantry_items_owner_item_type_created_at_idx" ON "pantry_items" USING btree ("owner_user_id","item_type","created_at");--> statement-breakpoint
CREATE INDEX "pantry_items_owner_name_idx" ON "pantry_items" USING btree ("owner_user_id","name");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "nutrients" ("key","display_name","canonical_unit") VALUES
  ('calories','Calories','kcal'),
  ('protein','Protein','g'),
  ('fat','Fat','g'),
  ('carbohydrates','Carbohydrates','g')
ON CONFLICT ("key") DO NOTHING;