-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('TOP', 'BOTTOM', 'SHOES', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "ItemZone" AS ENUM ('WARDROBE', 'LOOK', 'NEW');

-- CreateEnum
CREATE TYPE "TryonStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "wardrobe_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zone" "ItemZone" NOT NULL DEFAULT 'WARDROBE',
    "category" "ItemCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "color" TEXT,
    "material" TEXT,
    "sizeLabel" TEXT,
    "priceCents" INTEGER,
    "purchasedAt" TIMESTAMP(3),
    "note" TEXT,
    "coverKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wardrobe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wardrobe_item_images" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "originalKey" TEXT,
    "whiteKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wardrobe_item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_tags" (
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "item_tags_pkey" PRIMARY KEY ("itemId","tagId")
);

-- CreateTable
CREATE TABLE "outfits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occasion" TEXT,
    "wornAt" TIMESTAMP(3),
    "note" TEXT,
    "photoKey" TEXT,
    "collageKey" TEXT,
    "canvas" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outfit_items" (
    "outfitId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outfit_items_pkey" PRIMARY KEY ("outfitId","itemId")
);

-- CreateTable
CREATE TABLE "outfit_tags" (
    "outfitId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "outfit_tags_pkey" PRIMARY KEY ("outfitId","tagId")
);

-- CreateTable
CREATE TABLE "tryon_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TryonStatus" NOT NULL DEFAULT 'PENDING',
    "mpsTaskId" TEXT,
    "resultKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tryon_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tryon_record_items" (
    "recordId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tryon_record_items_pkey" PRIMARY KEY ("recordId","itemId")
);

-- CreateIndex
CREATE INDEX "wardrobe_items_userId_zone_category_idx" ON "wardrobe_items"("userId", "zone", "category");

-- CreateIndex
CREATE INDEX "wardrobe_items_userId_name_idx" ON "wardrobe_items"("userId", "name");

-- CreateIndex
CREATE INDEX "wardrobe_item_images_itemId_idx" ON "wardrobe_item_images"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");

-- CreateIndex
CREATE INDEX "outfits_userId_createdAt_idx" ON "outfits"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "tryon_records_userId_createdAt_idx" ON "tryon_records"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_item_images" ADD CONSTRAINT "wardrobe_item_images_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "wardrobe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "wardrobe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tags" ADD CONSTRAINT "item_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfits" ADD CONSTRAINT "outfits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "outfits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_items" ADD CONSTRAINT "outfit_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "wardrobe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_tags" ADD CONSTRAINT "outfit_tags_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "outfits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outfit_tags" ADD CONSTRAINT "outfit_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryon_records" ADD CONSTRAINT "tryon_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryon_record_items" ADD CONSTRAINT "tryon_record_items_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "tryon_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tryon_record_items" ADD CONSTRAINT "tryon_record_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "wardrobe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
