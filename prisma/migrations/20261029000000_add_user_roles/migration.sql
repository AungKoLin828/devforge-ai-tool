-- Add platform-level role and block flag for admin user management.
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
