/*
  Warnings:

  - You are about to drop the column `usename` on the `Customer` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `username` to the `Customer` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Customer_usename_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "usename",
ADD COLUMN     "username" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_username_key" ON "Customer"("username");
