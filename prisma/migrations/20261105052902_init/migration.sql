-- CreateEnum
CREATE TYPE "MagazineType" AS ENUM ('CURATION', 'ISSUE');

-- CreateEnum
CREATE TYPE "MagazineStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magazines" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "keyword" TEXT NOT NULL,
    "type" "MagazineType" NOT NULL DEFAULT 'CURATION',
    "template" TEXT NOT NULL DEFAULT 'classic',
    "status" "MagazineStatus" NOT NULL DEFAULT 'DRAFT',
    "caption" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'paper',
    "category" TEXT NOT NULL DEFAULT 'MUSIC CURATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorId" INTEGER NOT NULL,

    CONSTRAINT "magazines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'story',
    "magazineId" INTEGER NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" SERIAL NOT NULL,
    "outlet" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "magazineId" INTEGER NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "magazines_authorId_idx" ON "magazines"("authorId");

-- CreateIndex
CREATE INDEX "magazines_status_idx" ON "magazines"("status");

-- CreateIndex
CREATE INDEX "cards_magazineId_order_idx" ON "cards"("magazineId", "order");

-- CreateIndex
CREATE INDEX "sources_magazineId_idx" ON "sources"("magazineId");

-- AddForeignKey
ALTER TABLE "magazines" ADD CONSTRAINT "magazines_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_magazineId_fkey" FOREIGN KEY ("magazineId") REFERENCES "magazines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
