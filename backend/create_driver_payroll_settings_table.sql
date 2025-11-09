-- Create driver_payroll_settings table
CREATE TABLE IF NOT EXISTS driver_payroll_settings (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    dispatch_fee_percent NUMERIC(5, 2) DEFAULT 0,
    insurance_weekly NUMERIC(10, 2) DEFAULT 0,
    parking_weekly NUMERIC(10, 2) DEFAULT 0,
    trailer_weekly NUMERIC(10, 2) DEFAULT 0,
    misc_weekly NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on driver_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_driver_payroll_settings_driver_id ON driver_payroll_settings(driver_id);

-- Create index on company_id
CREATE INDEX IF NOT EXISTS idx_driver_payroll_settings_company_id ON driver_payroll_settings(company_id);
