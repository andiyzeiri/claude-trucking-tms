-- Fresh schema for Absolute TMS
-- Integer-based IDs with companies (not tenants)

-- Enable PostGIS for location tracking
CREATE EXTENSION IF NOT EXISTS postgis;

-- Companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    mc_number VARCHAR UNIQUE,
    dot_number VARCHAR UNIQUE,
    address TEXT,
    city VARCHAR,
    state VARCHAR,
    zip_code VARCHAR,
    phone VARCHAR,
    email VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    role VARCHAR NOT NULL DEFAULT 'viewer',
    page_permissions JSONB,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    contact_person VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    address TEXT,
    city VARCHAR,
    state VARCHAR,
    zip_code VARCHAR,
    billing_address TEXT,
    payment_terms VARCHAR,
    credit_limit VARCHAR,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Drivers table
CREATE TYPE driver_status AS ENUM ('AVAILABLE', 'ON_DUTY', 'DRIVING', 'OFF_DUTY', 'SLEEPER');

CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    license_number VARCHAR UNIQUE NOT NULL,
    license_expiry DATE,
    phone VARCHAR,
    email VARCHAR,
    status driver_status DEFAULT 'AVAILABLE',
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Trucks table
CREATE TYPE truck_type AS ENUM ('BOX_TRUCK', 'FLATBED', 'REEFER', 'DRY_VAN', 'TANKER', 'STEPDECK', 'LOWBOY', 'CONESTOGA');
CREATE TYPE truck_status AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'OUT_OF_SERVICE');

CREATE TABLE trucks (
    id SERIAL PRIMARY KEY,
    type truck_type NOT NULL,
    truck_number VARCHAR UNIQUE NOT NULL,
    vin VARCHAR UNIQUE,
    make VARCHAR,
    model VARCHAR,
    year INTEGER,
    license_plate VARCHAR,
    status truck_status DEFAULT 'AVAILABLE',
    current_location GEOMETRY(POINT, 4326),
    company_id INTEGER NOT NULL REFERENCES companies(id),
    current_driver_id INTEGER REFERENCES drivers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Don't create the spatial index manually - PostGIS handles it
-- CREATE INDEX idx_trucks_current_location ON trucks USING gist (current_location);

-- Loads table
CREATE TYPE load_status AS ENUM ('available', 'dispatched', 'invoiced');

CREATE TABLE loads (
    id SERIAL PRIMARY KEY,
    load_number VARCHAR,
    reference_number VARCHAR,
    description TEXT,
    pickup_location VARCHAR,
    delivery_location VARCHAR,
    miles INTEGER,
    rate NUMERIC(10, 2),
    carrier_rate NUMERIC(10, 2),
    fuel_surcharge NUMERIC(10, 2) DEFAULT 0,
    accessorial_charges NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2),
    pickup_date TIMESTAMP,
    delivery_date TIMESTAMP,
    pickup_deadline TIMESTAMP,
    delivery_deadline TIMESTAMP,
    status load_status DEFAULT 'available',
    pod_url VARCHAR,
    ratecon_url VARCHAR,
    pickup_notes TEXT,
    delivery_notes TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    truck_id INTEGER REFERENCES trucks(id),
    driver_id INTEGER REFERENCES drivers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Lanes table
CREATE TABLE lanes (
    id SERIAL PRIMARY KEY,
    pickup_location VARCHAR NOT NULL,
    delivery_location VARCHAR NOT NULL,
    broker VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    notes TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Invoices table
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    total_amount NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    status invoice_status DEFAULT 'DRAFT',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    notes TEXT,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add indices for common queries
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_drivers_company ON drivers(company_id);
CREATE INDEX idx_trucks_company ON trucks(company_id);
CREATE INDEX idx_loads_company ON loads(company_id);
CREATE INDEX idx_loads_status ON loads(status);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
