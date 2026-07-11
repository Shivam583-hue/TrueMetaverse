-- AlterTable
ALTER TABLE "Map" ADD COLUMN     "mapImage" TEXT;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "mapImage" TEXT,
ADD COLUMN     "official" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spaceId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudySession_id_key" ON "StudySession"("id");

-- CreateIndex
CREATE INDEX "StudySession_userId_endedAt_idx" ON "StudySession"("userId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Space_code_key" ON "Space"("code");

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

