-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footprints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "footprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favorites_userId_createdAt_idx" ON "favorites"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_userId_productId_key" ON "favorites"("userId", "productId");

-- CreateIndex
CREATE INDEX "footprints_userId_viewedAt_idx" ON "footprints"("userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "footprints_userId_productId_key" ON "footprints"("userId", "productId");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footprints" ADD CONSTRAINT "footprints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footprints" ADD CONSTRAINT "footprints_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
