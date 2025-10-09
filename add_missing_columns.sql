-- Add missing columns to loads table
ALTER TABLE loads ADD COLUMN IF NOT EXISTS pod_url VARCHAR;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS ratecon_url VARCHAR;
