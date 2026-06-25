CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "TransportType" AS ENUM ('TAXI', 'WALK', 'TRAIN', 'BUS', 'SHIP', 'FLIGHT');

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "locale" VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "trips" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "start_date" DATE,
  "end_date" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "itinerary_plans" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trip_id" TEXT NOT NULL,
  "plan_name" VARCHAR(50) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itinerary_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "itinerary_days" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "plan_id" TEXT NOT NULL,
  "iso_date" DATE NOT NULL,
  "date_label" VARCHAR(20) NOT NULL,
  "day_title" VARCHAR(20) NOT NULL,
  "theme" VARCHAR(100) NOT NULL,
  "focus" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itinerary_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "itinerary_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "itinerary_items" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "day_id" TEXT NOT NULL,
  "time" VARCHAR(5) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "address_jp" VARCHAR(300),
  "address_en" VARCHAR(300),
  "lat" DECIMAL(10,7) NOT NULL,
  "lng" DECIMAL(10,7) NOT NULL,
  "transport_type" "TransportType" NOT NULL DEFAULT 'WALK',
  "transport_detail" VARCHAR(200),
  "google_maps_query" VARCHAR(300),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "itinerary_items_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "itinerary_days"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "recommended_foods" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "recommended_foods_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "nearby_spots" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "nearby_spots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "shopping_spots" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "item_id" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "shopping_spots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "progress" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "is_completed" BOOLEAN NOT NULL DEFAULT false,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "itinerary_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "progress_user_id_item_id_key" UNIQUE ("user_id", "item_id")
);

CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");
CREATE INDEX "itinerary_plans_trip_id_sort_order_idx" ON "itinerary_plans"("trip_id", "sort_order");
CREATE INDEX "itinerary_days_plan_id_sort_order_idx" ON "itinerary_days"("plan_id", "sort_order");
CREATE INDEX "itinerary_items_day_id_sort_order_idx" ON "itinerary_items"("day_id", "sort_order");
CREATE INDEX "recommended_foods_item_id_sort_order_idx" ON "recommended_foods"("item_id", "sort_order");
CREATE INDEX "nearby_spots_item_id_sort_order_idx" ON "nearby_spots"("item_id", "sort_order");
CREATE INDEX "shopping_spots_item_id_sort_order_idx" ON "shopping_spots"("item_id", "sort_order");
CREATE INDEX "progress_item_id_idx" ON "progress"("item_id");