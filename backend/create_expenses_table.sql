-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category VARCHAR NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    vendor VARCHAR,
    payment_method VARCHAR,
    receipt_number VARCHAR,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    driver_id INTEGER REFERENCES drivers(id),
    truck_id INTEGER REFERENCES trucks(id),
    load_id INTEGER REFERENCES loads(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Create index on id
CREATE INDEX IF NOT EXISTS ix_expenses_id ON expenses(id);
