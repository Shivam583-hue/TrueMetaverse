-- Add per-user layered WOKA appearance (nullable; single-image avatar remains as fallback)
ALTER TABLE "User" ADD COLUMN "wokaAppearance" JSONB;
