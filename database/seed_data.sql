-- =================================================================================
-- ABSOLUTE TMS - Sample Data for Development
-- =================================================================================

-- =================================================================================
-- SAMPLE TENANTS
-- =================================================================================

INSERT INTO tenants (id, name, slug, contact_email, subscription_plan, max_drivers, max_trucks) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'ACME Trucking', 'acme', 'admin@acme.com', 'professional', 25, 25),
('550e8400-e29b-41d4-a716-446655440002', 'Global Transport', 'global', 'admin@global.com', 'enterprise', 999, 999),
('550e8400-e29b-41d4-a716-446655440003', 'Small Fleet LLC', 'small-fleet', 'admin@smallfleet.com', 'starter', 5, 5);

-- =================================================================================
-- SAMPLE USERS
-- =================================================================================

-- ACME Trucking Users
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@acme.com', '$2b$12$example_hash', 'John', 'Smith', 'admin'),
('550e8400-e29b-41d4-a716-446655440001', 'dispatcher@acme.com', '$2b$12$example_hash', 'Sarah', 'Johnson', 'dispatcher'),
('550e8400-e29b-41d4-a716-446655440001', 'manager@acme.com', '$2b$12$example_hash', 'Mike', 'Wilson', 'manager');

-- Global Transport Users
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'admin@global.com', '$2b$12$example_hash', 'Lisa', 'Davis', 'admin'),
('550e8400-e29b-41d4-a716-446655440002', 'ops@global.com', '$2b$12$example_hash', 'Robert', 'Brown', 'manager');

-- =================================================================================
-- SAMPLE CUSTOMERS
-- =================================================================================

-- ACME Trucking Customers
INSERT INTO customers (tenant_id, name, contact_person, email, phone, mc_number, payment_terms) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'ABC Logistics', 'Tom Anderson', 'tom@abclogistics.com', '(555) 123-4567', 'MC-123456', 'NET30'),
('550e8400-e29b-41d4-a716-446655440001', 'XYZ Shipping', 'Mary Johnson', 'mary@xyzship.com', '(555) 987-6543', 'MC-789012', 'NET15'),
('550e8400-e29b-41d4-a716-446655440001', 'Fast Freight Co', 'David Lee', 'david@fastfreight.com', '(555) 456-7890', 'MC-456789', 'NET30');

-- Global Transport Customers
INSERT INTO customers (tenant_id, name, contact_person, email, phone, mc_number, payment_terms) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'Mega Corp', 'Jennifer White', 'jen@megacorp.com', '(555) 111-2222', 'MC-111222', 'NET30'),
('550e8400-e29b-41d4-a716-446655440002', 'Supply Chain Inc', 'Chris Green', 'chris@supplychain.com', '(555) 333-4444', 'MC-333444', 'NET45');

-- =================================================================================
-- SAMPLE TRUCKS
-- =================================================================================

-- ACME Trucking Fleet
INSERT INTO trucks (tenant_id, truck_number, make, model, year, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', '101', 'Peterbilt', '579', 2022, 'active'),
('550e8400-e29b-41d4-a716-446655440001', '102', 'Kenworth', 'T680', 2023, 'active'),
('550e8400-e29b-41d4-a716-446655440001', '103', 'Freightliner', 'Cascadia', 2021, 'active'),
('550e8400-e29b-41d4-a716-446655440001', '104', 'Volvo', 'VNL', 2022, 'maintenance');

-- Global Transport Fleet
INSERT INTO trucks (tenant_id, truck_number, make, model, year, status) VALUES
('550e8400-e29b-41d4-a716-446655440002', '201', 'Mack', 'Anthem', 2023, 'active'),
('550e8400-e29b-41d4-a716-446655440002', '202', 'International', 'LT', 2022, 'active');

-- =================================================================================
-- SAMPLE DRIVERS
-- =================================================================================

-- ACME Trucking Drivers
INSERT INTO drivers (tenant_id, first_name, last_name, email, phone, license_number, driver_type, status, pay_rate, truck_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'John', 'Smith', 'john.smith@acme.com', '(555) 123-1111', 'DL123456789', 'company', 'active', 0.65, (SELECT id FROM trucks WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND truck_number = '101')),
('550e8400-e29b-41d4-a716-446655440001', 'Jane', 'Doe', 'jane.doe@acme.com', '(555) 123-2222', 'DL987654321', 'company', 'active', 0.70, (SELECT id FROM trucks WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND truck_number = '102')),
('550e8400-e29b-41d4-a716-446655440001', 'Robert', 'Wilson', 'robert@gmail.com', '(555) 123-3333', 'DL456789123', 'owner_operator', 'active', 0.90, NULL),
('550e8400-e29b-41d4-a716-446655440001', 'Sarah', 'Davis', 'sarah@outlook.com', '(555) 123-4444', 'DL789123456', 'owner_operator', 'active', 0.85, NULL);

-- Global Transport Drivers
INSERT INTO drivers (tenant_id, first_name, last_name, email, phone, license_number, driver_type, status, pay_rate, truck_id) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'Mike', 'Johnson', 'mike.johnson@global.com', '(555) 222-1111', 'DL111222333', 'company', 'active', 0.68, (SELECT id FROM trucks WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440002' AND truck_number = '201'));

-- =================================================================================
-- SAMPLE LANES
-- =================================================================================

-- ACME Trucking Lanes
INSERT INTO lanes (tenant_id, pickup_location, delivery_location, distance_miles) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Los Angeles, CA', 'Phoenix, AZ', 385),
('550e8400-e29b-41d4-a716-446655440001', 'Dallas, TX', 'Houston, TX', 240),
('550e8400-e29b-41d4-a716-446655440001', 'Chicago, IL', 'Milwaukee, WI', 92);

-- Lane Brokers
INSERT INTO lane_brokers (tenant_id, lane_id, broker_name, contact_email, contact_phone, average_rate) VALUES
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM lanes WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND pickup_location = 'Los Angeles, CA'), 'Western Logistics', 'dispatch@western.com', '(555) 800-1111', 2400.00),
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM lanes WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND pickup_location = 'Los Angeles, CA'), 'Southwest Freight', 'ops@southwest.com', '(555) 800-2222', 2600.00),
('550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM lanes WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND pickup_location = 'Dallas, TX'), 'Texas Transport', 'loads@texas.com', '(555) 800-3333', 1200.00);

-- =================================================================================
-- SAMPLE PAYROLL PERIODS
-- =================================================================================

INSERT INTO payroll_periods (tenant_id, period_start, period_end, week_number, year, status) VALUES
('550e8400-e29b-41d4-a716-446655440001', '2024-12-30', '2025-01-05', 1, 2025, 'completed'),
('550e8400-e29b-41d4-a716-446655440001', '2025-01-06', '2025-01-12', 2, 2025, 'completed'),
('550e8400-e29b-41d4-a716-446655440001', '2025-01-13', '2025-01-19', 3, 2025, 'open'),
('550e8400-e29b-41d4-a716-446655440001', '2025-01-20', '2025-01-26', 4, 2025, 'open');

-- =================================================================================
-- SAMPLE LOADS
-- =================================================================================

-- ACME Trucking Loads
INSERT INTO loads (
    tenant_id, load_number, customer_id, driver_id, pickup_location, delivery_location,
    pickup_date, pickup_time, delivery_date, delivery_time, rate, miles, status
) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'TMS001',
 (SELECT id FROM customers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND name = 'ABC Logistics'),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'John'),
 'Los Angeles, CA', 'Phoenix, AZ', '2025-01-15', '08:00:00', '2025-01-17', '14:00:00',
 2500.00, 385, 'in_transit'),

('550e8400-e29b-41d4-a716-446655440001', 'TMS002',
 (SELECT id FROM customers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND name = 'XYZ Shipping'),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'Jane'),
 'Dallas, TX', 'Houston, TX', '2025-01-14', '09:30:00', '2025-01-15', '16:30:00',
 1200.00, 240, 'delivered'),

('550e8400-e29b-41d4-a716-446655440001', 'TMS003',
 (SELECT id FROM customers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND name = 'Fast Freight Co'),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'Robert'),
 'Chicago, IL', 'Milwaukee, WI', '2025-01-16', '07:00:00', '2025-01-17', '11:00:00',
 800.00, 92, 'booked');

-- =================================================================================
-- SAMPLE PAYROLL ENTRIES
-- =================================================================================

-- Week 1 Payroll
INSERT INTO payroll_entries (
    tenant_id, payroll_period_id, driver_id,
    gross_pay, miles_driven, rate_per_mile, dispatch_fee, insurance, fuel_costs,
    status
) VALUES
('550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM payroll_periods WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND week_number = 1),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'John'),
 2500.00, 1250, 0.65, 250.00, 150.00, 600.00, 'approved'),

('550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM payroll_periods WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND week_number = 1),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'Jane'),
 3200.00, 1600, 0.70, 320.00, 150.00, 800.00, 'approved'),

('550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM payroll_periods WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND week_number = 1),
 (SELECT id FROM drivers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND first_name = 'Sarah'),
 3800.00, 1900, 0.85, 380.00, 0.00, 0.00, 'approved');

-- =================================================================================
-- SAMPLE INVOICES
-- =================================================================================

INSERT INTO invoices (
    tenant_id, invoice_number, customer_id, invoice_date, due_date,
    subtotal, total_amount, status
) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'INV-2025-001',
 (SELECT id FROM customers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND name = 'ABC Logistics'),
 '2025-01-15', '2025-02-14', 2500.00, 2500.00, 'sent'),

('550e8400-e29b-41d4-a716-446655440001', 'INV-2025-002',
 (SELECT id FROM customers WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND name = 'XYZ Shipping'),
 '2025-01-16', '2025-01-31', 1200.00, 1200.00, 'paid');

-- Invoice line items
INSERT INTO invoice_line_items (tenant_id, invoice_id, load_id, description, rate, amount) VALUES
('550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM invoices WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND invoice_number = 'INV-2025-001'),
 (SELECT id FROM loads WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND load_number = 'TMS001'),
 'Los Angeles, CA to Phoenix, AZ - Load #TMS001', 2500.00, 2500.00),

('550e8400-e29b-41d4-a716-446655440001',
 (SELECT id FROM invoices WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND invoice_number = 'INV-2025-002'),
 (SELECT id FROM loads WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001' AND load_number = 'TMS002'),
 'Dallas, TX to Houston, TX - Load #TMS002', 1200.00, 1200.00);

-- =================================================================================
-- SAMPLE TENANT SETTINGS
-- =================================================================================

INSERT INTO tenant_settings (tenant_id, setting_key, setting_value) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'company_name', 'ACME Trucking LLC'),
('550e8400-e29b-41d4-a716-446655440001', 'default_dispatch_fee_percent', '10'),
('550e8400-e29b-41d4-a716-446655440001', 'insurance_per_week', '150'),
('550e8400-e29b-41d4-a716-446655440001', 'fuel_surcharge_rate', '0.05'),
('550e8400-e29b-41d4-a716-446655440001', 'invoice_payment_terms', 'NET30'),
('550e8400-e29b-41d4-a716-446655440001', 'timezone', 'America/Los_Angeles');

-- =================================================================================
-- SAMPLE USAGE DATA
-- =================================================================================

INSERT INTO tenant_usage (tenant_id, month_year, loads_count, drivers_count, api_calls) VALUES
('550e8400-e29b-41d4-a716-446655440001', '2025-01', 15, 4, 2500),
('550e8400-e29b-41d4-a716-446655440002', '2025-01', 45, 8, 7500),
('550e8400-e29b-41d4-a716-446655440003', '2025-01', 3, 2, 450);