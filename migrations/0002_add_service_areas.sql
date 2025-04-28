-- Add service_areas column to contractor_profiles table
ALTER TABLE contractor_profiles ADD COLUMN IF NOT EXISTS service_areas JSONB DEFAULT '[]'::jsonb;