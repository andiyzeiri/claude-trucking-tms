INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Generating static SQL
INFO  [alembic.runtime.migration] Will assume transactional DDL.
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 3f4b24be8ae3

INFO  [alembic.runtime.migration] Running upgrade  -> 3f4b24be8ae3, Initial schema
CREATE TABLE companies (
    name VARCHAR NOT NULL, 
    mc_number VARCHAR, 
    dot_number VARCHAR, 
    address TEXT, 
    city VARCHAR, 
    state VARCHAR, 
    zip_code VARCHAR, 
    phone VARCHAR, 
    email VARCHAR, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_companies_dot_number ON companies (dot_number);

CREATE INDEX ix_companies_id ON companies (id);

CREATE UNIQUE INDEX ix_companies_mc_number ON companies (mc_number);

CREATE TABLE customers (
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
    company_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id)
);

CREATE INDEX ix_customers_id ON customers (id);

CREATE TYPE driverstatus AS ENUM ('AVAILABLE', 'ON_DUTY', 'DRIVING', 'OFF_DUTY', 'SLEEPER');

CREATE TABLE drivers (
    first_name VARCHAR NOT NULL, 
    last_name VARCHAR NOT NULL, 
    license_number VARCHAR NOT NULL, 
    license_expiry DATE, 
    phone VARCHAR, 
    email VARCHAR, 
    status driverstatus, 
    company_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    UNIQUE (license_number)
);

CREATE INDEX ix_drivers_id ON drivers (id);

CREATE TABLE lanes (
    pickup_location VARCHAR NOT NULL, 
    delivery_location VARCHAR NOT NULL, 
    broker VARCHAR NOT NULL, 
    email VARCHAR, 
    phone VARCHAR, 
    notes TEXT, 
    company_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id)
);

CREATE INDEX ix_lanes_id ON lanes (id);

CREATE TABLE users (
    username VARCHAR NOT NULL, 
    email VARCHAR NOT NULL, 
    hashed_password VARCHAR NOT NULL, 
    first_name VARCHAR NOT NULL, 
    last_name VARCHAR NOT NULL, 
    is_active BOOLEAN, 
    is_superuser BOOLEAN, 
    email_verified BOOLEAN, 
    email_verified_at TIMESTAMP WITHOUT TIME ZONE, 
    role VARCHAR NOT NULL, 
    page_permissions JSON, 
    company_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_id ON users (id);

CREATE UNIQUE INDEX ix_users_username ON users (username);

CREATE TABLE email_verification_tokens (
    user_id INTEGER NOT NULL, 
    token VARCHAR NOT NULL, 
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    used BOOLEAN, 
    used_at TIMESTAMP WITHOUT TIME ZONE, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_email_verification_tokens_id ON email_verification_tokens (id);

CREATE UNIQUE INDEX ix_email_verification_tokens_token ON email_verification_tokens (token);

CREATE TYPE payrolltype AS ENUM ('COMPANY', 'OWNER_OPERATOR');

CREATE TABLE payroll (
    week_start DATE NOT NULL, 
    week_end DATE NOT NULL, 
    driver_id INTEGER NOT NULL, 
    type payrolltype NOT NULL, 
    gross FLOAT, 
    extra FLOAT, 
    dispatch_fee FLOAT, 
    insurance FLOAT, 
    fuel FLOAT, 
    parking FLOAT, 
    trailer FLOAT, 
    misc FLOAT, 
    escrow FLOAT, 
    miles INTEGER, 
    company_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    FOREIGN KEY(driver_id) REFERENCES drivers (id)
);

CREATE INDEX ix_payroll_id ON payroll (id);

CREATE TYPE trucktype AS ENUM ('TRUCK', 'TRAILER');

CREATE TYPE truckstatus AS ENUM ('AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE', 'OUT_OF_SERVICE');

CREATE TABLE trucks (
    type trucktype NOT NULL, 
    truck_number VARCHAR NOT NULL, 
    vin VARCHAR, 
    make VARCHAR, 
    model VARCHAR, 
    year INTEGER, 
    license_plate VARCHAR, 
    status truckstatus, 
    current_location geometry(POINT,4326), 
    company_id INTEGER NOT NULL, 
    current_driver_id INTEGER, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    FOREIGN KEY(current_driver_id) REFERENCES drivers (id), 
    UNIQUE (vin)
);

CREATE INDEX idx_trucks_current_location ON trucks USING gist (current_location);

CREATE INDEX idx_trucks_current_location ON trucks USING gist (current_location);

CREATE INDEX ix_trucks_id ON trucks (id);

CREATE TYPE loadstatus AS ENUM ('PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

CREATE TABLE loads (
    load_number VARCHAR NOT NULL, 
    reference_number VARCHAR, 
    description TEXT, 
    pickup_location VARCHAR, 
    delivery_location VARCHAR, 
    miles INTEGER, 
    rate NUMERIC(10, 2), 
    fuel_surcharge NUMERIC(10, 2), 
    accessorial_charges NUMERIC(10, 2), 
    total_amount NUMERIC(10, 2), 
    pickup_date TIMESTAMP WITHOUT TIME ZONE, 
    delivery_date TIMESTAMP WITHOUT TIME ZONE, 
    pickup_deadline TIMESTAMP WITHOUT TIME ZONE, 
    delivery_deadline TIMESTAMP WITHOUT TIME ZONE, 
    status loadstatus, 
    company_id INTEGER NOT NULL, 
    customer_id INTEGER NOT NULL, 
    truck_id INTEGER, 
    driver_id INTEGER, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    FOREIGN KEY(customer_id) REFERENCES customers (id), 
    FOREIGN KEY(driver_id) REFERENCES drivers (id), 
    FOREIGN KEY(truck_id) REFERENCES trucks (id)
);

CREATE INDEX ix_loads_id ON loads (id);

CREATE UNIQUE INDEX ix_loads_load_number ON loads (load_number);

CREATE TYPE invoicestatus AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE invoices (
    invoice_number VARCHAR NOT NULL, 
    issue_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    due_date TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    status invoicestatus, 
    subtotal NUMERIC(10, 2) NOT NULL, 
    tax_amount NUMERIC(10, 2), 
    total_amount NUMERIC(10, 2) NOT NULL, 
    amount_paid NUMERIC(10, 2), 
    payment_date TIMESTAMP WITHOUT TIME ZONE, 
    payment_method VARCHAR, 
    payment_reference VARCHAR, 
    notes TEXT, 
    terms TEXT, 
    load_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(load_id) REFERENCES loads (id)
);

CREATE INDEX ix_invoices_id ON invoices (id);

CREATE UNIQUE INDEX ix_invoices_invoice_number ON invoices (invoice_number);

CREATE TYPE stoptype AS ENUM ('PICKUP', 'DELIVERY', 'FUEL', 'REST');

CREATE TYPE stopstatus AS ENUM ('PENDING', 'ARRIVED', 'LOADING', 'COMPLETED', 'SKIPPED');

CREATE TABLE stops (
    sequence INTEGER NOT NULL, 
    stop_type stoptype NOT NULL, 
    status stopstatus, 
    name VARCHAR NOT NULL, 
    address TEXT NOT NULL, 
    city VARCHAR NOT NULL, 
    state VARCHAR NOT NULL, 
    zip_code VARCHAR NOT NULL, 
    coordinates geometry(POINT,4326), 
    contact_name VARCHAR, 
    contact_phone VARCHAR, 
    scheduled_arrival TIMESTAMP WITHOUT TIME ZONE, 
    scheduled_departure TIMESTAMP WITHOUT TIME ZONE, 
    actual_arrival TIMESTAMP WITHOUT TIME ZONE, 
    actual_departure TIMESTAMP WITHOUT TIME ZONE, 
    geofence_radius INTEGER, 
    auto_arrival_detected BOOLEAN, 
    notes TEXT, 
    pod_required BOOLEAN, 
    bol_required BOOLEAN, 
    load_id INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(load_id) REFERENCES loads (id)
);

CREATE INDEX idx_stops_coordinates ON stops USING gist (coordinates);

CREATE INDEX idx_stops_coordinates ON stops USING gist (coordinates);

CREATE INDEX ix_stops_id ON stops (id);

DROP TABLE spatial_ref_sys;

DROP TABLE topology;

DROP TABLE layer;

INSERT INTO alembic_version (version_num) VALUES ('3f4b24be8ae3') RETURNING alembic_version.version_num;

COMMIT;

