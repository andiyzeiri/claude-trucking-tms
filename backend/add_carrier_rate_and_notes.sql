-- Add carrier_rate, pickup_notes, and delivery_notes to loads table
ALTER TABLE loads
ADD COLUMN IF NOT EXISTS carrier_rate NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS pickup_notes TEXT,
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
