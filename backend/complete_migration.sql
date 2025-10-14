-- Complete Migration: Add Shippers, Receivers, Ratecons tables and MC field to customers
-- Run this on the production database

-- 1. Add MC field to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS mc VARCHAR;

-- 2. Create shippers table
CREATE TABLE IF NOT EXISTS shippers (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    address TEXT,
    city VARCHAR,
    state VARCHAR,
    zip_code VARCHAR,
    phone VARCHAR,
    contact_person VARCHAR,
    email VARCHAR,
    product_type VARCHAR,
    average_wait_time VARCHAR,
    appointment_type VARCHAR,
    notes TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_shippers_id ON shippers (id);

-- 3. Create receivers table
CREATE TABLE IF NOT EXISTS receivers (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    address TEXT,
    city VARCHAR,
    state VARCHAR,
    zip_code VARCHAR,
    phone VARCHAR,
    contact_person VARCHAR,
    email VARCHAR,
    product_type VARCHAR,
    average_wait_time VARCHAR,
    appointment_type VARCHAR,
    notes TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_receivers_id ON receivers (id);

-- 4. Create ratecons table
CREATE TABLE IF NOT EXISTS ratecons (
    id SERIAL PRIMARY KEY,
    ratecon_number VARCHAR UNIQUE NOT NULL,
    load_number VARCHAR,
    broker_name VARCHAR NOT NULL,
    carrier_name VARCHAR,
    date_issued DATE,
    pickup_date DATE,
    delivery_date DATE,
    pickup_location TEXT,
    delivery_location TEXT,
    total_rate DOUBLE PRECISION,
    fuel_surcharge DOUBLE PRECISION,
    detention_rate DOUBLE PRECISION,
    layover_rate DOUBLE PRECISION,
    commodity VARCHAR,
    weight DOUBLE PRECISION,
    pieces INTEGER,
    equipment_type VARCHAR,
    broker_contact VARCHAR,
    broker_phone VARCHAR,
    broker_email VARCHAR,
    payment_terms VARCHAR,
    special_instructions TEXT,
    notes TEXT,
    status VARCHAR DEFAULT 'pending',
    document_url VARCHAR,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS ix_ratecons_id ON ratecons (id);
CREATE INDEX IF NOT EXISTS ix_ratecons_ratecon_number ON ratecons (ratecon_number);

-- Verification queries
SELECT
    'MC column added to customers' as status,
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'customers'
        AND column_name = 'mc'
    ) as exists;

SELECT
    'Shippers table created' as status,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'shippers'
    ) as exists;

SELECT
    'Receivers table created' as status,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'receivers'
    ) as exists;

SELECT
    'Ratecons table created' as status,
    EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'ratecons'
    ) as exists;
