/*
  Warnings:

  - You are about to drop the column `htmlContent` on the `Store` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Store" DROP COLUMN "htmlContent",
ADD COLUMN     "heroDescription" TEXT DEFAULT 'Los mejores productos, a los mejores precios.',
ADD COLUMN     "heroTitle" TEXT DEFAULT 'Bienvenidos a mi Tienda',
ADD COLUMN     "primaryColor" TEXT DEFAULT '#0f172a',
ADD COLUMN     "template" TEXT DEFAULT 'moderno';
