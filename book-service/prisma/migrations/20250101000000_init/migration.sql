-- CreateTable
CREATE TABLE "LibraryEntry" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "workId" TEXT NOT NULL,
  "user" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryEntry_user_workId_key" ON "LibraryEntry"("user", "workId");
