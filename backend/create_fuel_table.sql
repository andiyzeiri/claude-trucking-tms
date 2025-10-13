-- Create fuel table
CREATE TABLE IF NOT EXISTS fuel (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    location VARCHAR,
    gallons NUMERIC(10, 2) NOT NULL,
    price_per_gallon NUMERIC(10, 3),
    total_amount NUMERIC(10, 2) NOT NULL,
    odometer INTEGER,
    notes TEXT,

    -- Foreign keys
    company_id INTEGER NOT NULL REFERENCES companies(id),
    driver_id INTEGER REFERENCES drivers(id),
    truck_id INTEGER REFERENCES trucks(id),
    load_id INTEGER REFERENCES loads(id),

    -- Timestamps
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fuel_company_id ON fuel(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_driver_id ON fuel(driver_id);
CREATE INDEX IF NOT EXISTS idx_fuel_truck_id ON fuel(truck_id);
CREATE INDEX IF NOT EXISTS idx_fuel_date ON fuel(date);
