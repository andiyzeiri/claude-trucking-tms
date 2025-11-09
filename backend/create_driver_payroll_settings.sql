-- Create driver_payroll_settings table
CREATE TABLE IF NOT EXISTS driver_payroll_settings (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL UNIQUE,
    company_id INTEGER NOT NULL,
    dispatch_fee_percent NUMERIC(5, 2) DEFAULT 0,
    insurance_weekly NUMERIC(10, 2) DEFAULT 0,
    parking_weekly NUMERIC(10, 2) DEFAULT 0,
    trailer_weekly NUMERIC(10, 2) DEFAULT 0,
    misc_weekly NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Create index
CREATE INDEX IF NOT EXISTS ix_driver_payroll_settings_id ON driver_payroll_settings(id);

-- Insert alembic version record
INSERT INTO alembic_version (version_num) VALUES ('4a7c25df9be4')
ON CONFLICT (version_num) DO NOTHING;
