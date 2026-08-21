-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "RoomAccessLevel" AS ENUM ('PUBLIC', 'TRUSTED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('INITIATED', 'ACTIVE', 'STOPPED', 'SAVED', 'ABORTED', 'FAILED_TO_START', 'FAILED_TO_STOP', 'NOTIFICATION_SUCCEEDED');

-- CreateEnum
CREATE TYPE "RecordingMode" AS ENUM ('SCREEN_RECORDING', 'TRANSCRIPT');

-- CreateEnum
CREATE TYPE "FileUploadState" AS ENUM ('PENDING', 'ANALYZING', 'READY');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('BACKGROUND_IMAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "sub" TEXT,
    "email" TEXT,
    "adminEmail" TEXT,
    "fullName" TEXT,
    "shortName" TEXT,
    "language" TEXT NOT NULL DEFAULT 'fr-fr',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isDevice" BOOLEAN NOT NULL DEFAULT false,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "accessLevel" "RoomAccessLevel" NOT NULL DEFAULT 'PUBLIC',
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "pinCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_accesses" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordings" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "RecordingStatus" NOT NULL DEFAULT 'INITIATED',
    "workerId" TEXT,
    "mode" "RecordingMode" NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recording_accesses" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "userId" TEXT,
    "team" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "type" "FileType" NOT NULL DEFAULT 'BACKGROUND_IMAGE',
    "title" TEXT NOT NULL,
    "creatorId" TEXT,
    "filename" TEXT NOT NULL,
    "uploadState" "FileUploadState" NOT NULL DEFAULT 'PENDING',
    "mimetype" TEXT,
    "size" BIGINT,
    "description" TEXT,
    "malwareDetectionInfo" JSONB,
    "deletedAt" TIMESTAMP(3),
    "hardDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_domains" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,

    CONSTRAINT "application_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_sub_key" ON "users"("sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_adminEmail_key" ON "users"("adminEmail");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_pinCode_key" ON "rooms"("pinCode");

-- CreateIndex
CREATE UNIQUE INDEX "room_accesses_userId_roomId_key" ON "room_accesses"("userId", "roomId");

-- CreateIndex
CREATE UNIQUE INDEX "recording_accesses_userId_recordingId_key" ON "recording_accesses"("userId", "recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "applications_clientId_key" ON "applications"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "application_domains_applicationId_domain_key" ON "application_domains"("applicationId", "domain");

-- AddForeignKey
ALTER TABLE "room_accesses" ADD CONSTRAINT "room_accesses_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_accesses" ADD CONSTRAINT "room_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_accesses" ADD CONSTRAINT "recording_accesses_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "recordings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_accesses" ADD CONSTRAINT "recording_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_domains" ADD CONSTRAINT "application_domains_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
