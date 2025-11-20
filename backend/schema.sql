-- =================================================================================
-- ABSOLUTE TMS - Multi-Tenant SaaS Database Schema
-- =================================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================================
-- TENANT MANAGEMENT
-- =================================================================================

-- Core tenant table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- for subdomain routing (e.g., acme.absolutetms.com)
    contact_email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
    subscription_status VARCHAR(20) DEFAULT 'active', -- active, suspended, cancelled
    max_drivers INTEGER DEFAULT 5,
    max_trucks INTEGER DEFAULT 5,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Tenant usage tracking for billing
CREATE TABLE tenant_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- YYYY-MM format
    loads_count INTEGER DEFAULT 0,
    drivers_count INTEGER DEFAULT 0,
    storage_mb INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, month_year)
);

-- =================================================================================
-- USER MANAGEMENT
-- =================================================================================

-- Users table with role-based permissions
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- admin, manager, dispatcher, user
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User permissions
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- CUSTOMERS
-- =================================================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    mc_number VARCHAR(50),
    dot_number VARCHAR(50),
    credit_limit DECIMAL(10,2) DEFAULT 0.00,
    payment_terms VARCHAR(50) DEFAULT 'NET30',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customer contacts
CREATE TABLE customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- EQUIPMENT (TRUCKS)
-- =================================================================================

CREATE TABLE trucks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    truck_number VARCHAR(50) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    vin VARCHAR(50),
    license_plate VARCHAR(20),
    color VARCHAR(50),
    truck_type VARCHAR(50), -- dry_van, refrigerated, flatbed, etc.
    status VARCHAR(20) DEFAULT 'active', -- active, maintenance, retired
    purchase_date DATE,
    purchase_price DECIMAL(10,2),
    current_mileage INTEGER DEFAULT 0,
    fuel_capacity DECIMAL(6,2),
    insurance_company VARCHAR(255),
    insurance_policy VARCHAR(100),
    insurance_expiry DATE,
    registration_expiry DATE,
    inspection_expiry DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, truck_number)
);

-- =================================================================================
-- DRIVERS
-- =================================================================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    employee_id VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    date_of_birth DATE,
    hire_date DATE,
    termination_date DATE,
    driver_type VARCHAR(20) DEFAULT 'company', -- company, owner_operator
    license_number VARCHAR(50) NOT NULL,
    license_class VARCHAR(10),
    license_expiry DATE,
    medical_cert_expiry DATE,
    hazmat_expiry DATE,
    truck_id UUID REFERENCES trucks(id),
    pay_rate DECIMAL(8,4), -- per mile rate
    pay_type VARCHAR(20) DEFAULT 'per_mile', -- per_mile, hourly, salary
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, terminated
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, license_number)
);

-- =================================================================================
-- LANES
-- =================================================================================

CREATE TABLE lanes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    pickup_location VARCHAR(255) NOT NULL,
    delivery_location VARCHAR(255) NOT NULL,
    distance_miles INTEGER,
    estimated_drive_time VARCHAR(20), -- HH:MM format
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, pickup_location, delivery_location)
);

-- Lane brokers (multiple brokers per lane)
CREATE TABLE lane_brokers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    lane_id UUID REFERENCES lanes(id) ON DELETE CASCADE,
    broker_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    average_rate DECIMAL(8,2),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- LOADS
-- =================================================================================

CREATE TABLE loads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    load_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    driver_id UUID REFERENCES drivers(id),
    truck_id UUID REFERENCES trucks(id),
    lane_id UUID REFERENCES lanes(id),

    -- Load details
    pickup_location VARCHAR(255) NOT NULL,
    delivery_location VARCHAR(255) NOT NULL,
    pickup_date DATE,
    pickup_time TIME,
    delivery_date DATE,
    delivery_time TIME,

    -- Financial
    rate DECIMAL(10,2) NOT NULL,
    fuel_surcharge DECIMAL(8,2) DEFAULT 0.00,
    accessorial_charges DECIMAL(8,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,

    -- Load specifics
    commodity VARCHAR(255),
    weight_lbs INTEGER,
    pieces INTEGER DEFAULT 1,
    reference_numbers TEXT, -- JSON array of reference numbers
    special_instructions TEXT,

    -- Status tracking
    status VARCHAR(20) DEFAULT 'booked', -- booked, dispatched, in_transit, delivered, invoiced, paid
    miles INTEGER,

    -- Documents
    has_rate_confirmation BOOLEAN DEFAULT false,
    has_pod BOOLEAN DEFAULT false,
    has_bol BOOLEAN DEFAULT false,

    -- Timestamps
    booked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    pickup_actual TIMESTAMP WITH TIME ZONE,
    delivery_actual TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, load_number)
);

-- Load tracking events
CREATE TABLE load_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- status_change, location_update, document_uploaded
    description TEXT,
    location VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- PAYROLL
-- =================================================================================

-- Payroll periods (weekly)
CREATE TABLE payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, processing, completed, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, period_start, period_end)
);

-- Driver payroll entries
CREATE TABLE payroll_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,

    -- Earnings
    gross_pay DECIMAL(10,2) DEFAULT 0.00,
    miles_driven INTEGER DEFAULT 0,
    rate_per_mile DECIMAL(8,4) DEFAULT 0.00,
    bonus_pay DECIMAL(8,2) DEFAULT 0.00,
    other_pay DECIMAL(8,2) DEFAULT 0.00,

    -- Deductions
    dispatch_fee DECIMAL(8,2) DEFAULT 0.00,
    insurance DECIMAL(8,2) DEFAULT 0.00,
    fuel_costs DECIMAL(8,2) DEFAULT 0.00,
    maintenance DECIMAL(8,2) DEFAULT 0.00,
    parking_fees DECIMAL(8,2) DEFAULT 0.00,
    trailer_rental DECIMAL(8,2) DEFAULT 0.00,
    misc_deductions DECIMAL(8,2) DEFAULT 0.00,

    -- Calculated fields
    total_deductions DECIMAL(10,2) DEFAULT 0.00,
    net_pay DECIMAL(10,2) DEFAULT 0.00,
    escrow_amount DECIMAL(8,2) DEFAULT 0.00,

    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, approved, paid
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, payroll_period_id, driver_id)
);

-- =================================================================================
-- INVOICING
-- =================================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES customers(id) NOT NULL,

    -- Invoice details
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,4) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    payment_terms VARCHAR(50) DEFAULT 'NET30',

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tenant_id, invoice_number)
);

-- Invoice line items (individual loads)
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    load_id UUID REFERENCES loads(id),
    description TEXT NOT NULL,
    quantity DECIMAL(8,2) DEFAULT 1.00,
    rate DECIMAL(10,4) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- DOCUMENT STORAGE
-- =================================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    related_entity_type VARCHAR(50) NOT NULL, -- load, driver, truck, invoice
    related_entity_id UUID NOT NULL,

    -- Document details
    document_type VARCHAR(50) NOT NULL, -- rate_confirmation, pod, bol, license, insurance, etc.
    original_filename VARCHAR(255) NOT NULL,
    s3_key VARCHAR(500) NOT NULL, -- S3 object key
    file_size INTEGER NOT NULL,
    content_type VARCHAR(100) NOT NULL,

    -- Metadata
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- =================================================================================
-- SYSTEM SETTINGS
-- =================================================================================

CREATE TABLE tenant_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, setting_key)
);

-- =================================================================================
-- AUDIT TRAIL
-- =================================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[], -- array of changed field names
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =================================================================================
-- INDEXES FOR PERFORMANCE
-- =================================================================================

-- Tenant isolation indexes (most important)
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_drivers_tenant_id ON drivers(tenant_id);
CREATE INDEX idx_trucks_tenant_id ON trucks(tenant_id);
CREATE INDEX idx_loads_tenant_id ON loads(tenant_id);
CREATE INDEX idx_payroll_entries_tenant_id ON payroll_entries(tenant_id);
CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);

-- Performance indexes
CREATE INDEX idx_loads_status ON loads(tenant_id, status);
CREATE INDEX idx_loads_dates ON loads(tenant_id, pickup_date, delivery_date);
CREATE INDEX idx_drivers_status ON drivers(tenant_id, status);
CREATE INDEX idx_payroll_period ON payroll_entries(tenant_id, payroll_period_id);
CREATE INDEX idx_audit_logs_tenant_table ON audit_logs(tenant_id, table_name);

-- Search indexes
CREATE INDEX idx_customers_name ON customers(tenant_id, name);
CREATE INDEX idx_drivers_name ON drivers(tenant_id, first_name, last_name);
CREATE INDEX idx_loads_number ON loads(tenant_id, load_number);

-- =================================================================================
-- ROW LEVEL SECURITY (RLS) - TENANT ISOLATION
-- =================================================================================

-- Enable RLS on all tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (example for loads table)
CREATE POLICY tenant_isolation ON loads
    FOR ALL
    TO application_role
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =================================================================================
-- FUNCTIONS AND TRIGGERS
-- =================================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trucks_updated_at BEFORE UPDATE ON trucks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_loads_updated_at BEFORE UPDATE ON loads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_entries_updated_at BEFORE UPDATE ON payroll_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate payroll totals
CREATE OR REPLACE FUNCTION calculate_payroll_totals()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_deductions = COALESCE(NEW.dispatch_fee, 0) + COALESCE(NEW.insurance, 0) +
                          COALESCE(NEW.fuel_costs, 0) + COALESCE(NEW.maintenance, 0) +
                          COALESCE(NEW.parking_fees, 0) + COALESCE(NEW.trailer_rental, 0) +
                          COALESCE(NEW.misc_deductions, 0);

    NEW.net_pay = COALESCE(NEW.gross_pay, 0) - NEW.total_deductions - COALESCE(NEW.escrow_amount, 0);

    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_payroll_totals_trigger
    BEFORE INSERT OR UPDATE ON payroll_entries
    FOR EACH ROW EXECUTE FUNCTION calculate_payroll_totals();

-- =================================================================================
-- INITIAL DATA FOR DEVELOPMENT
-- =================================================================================

-- Create application role for RLS
CREATE ROLE application_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO application_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO application_role;

-- Sample tenant for development
INSERT INTO tenants (id, name, slug, contact_email, subscription_plan)
VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'Absolute Transport Demo',
    'demo',
    'demo@absolutetms.com',
    'professional'
);