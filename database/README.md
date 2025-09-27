# Absolute TMS - Database Schema

## Multi-Tenant SaaS Architecture

This database schema is designed for a multi-tenant SaaS TMS application with complete tenant isolation and enterprise-grade features.

## Key Features

### 🏢 **Multi-Tenancy**
- **Complete tenant isolation** using `tenant_id` foreign keys
- **Row Level Security (RLS)** policies for data protection
- **Subscription management** with usage tracking
- **Scalable to thousands of customers**

### 🔐 **Security**
- Row Level Security policies enforce tenant isolation
- Audit logging for all data changes
- User role-based permissions
- Encrypted sensitive data

### 📊 **Business Intelligence**
- Usage tracking for billing (loads, drivers, API calls, storage)
- Comprehensive audit trails
- Performance monitoring capabilities

### 💰 **SaaS Ready**
- Subscription tiers (starter, professional, enterprise)
- Usage-based billing integration
- Stripe customer ID tracking
- Tenant status management

## Database Tables

### Core Entities
- **tenants** - Customer organizations
- **users** - System users with role-based access
- **customers** - Freight customers
- **drivers** - Company and owner-operator drivers
- **trucks** - Equipment management
- **loads** - Shipment tracking
- **lanes** - Route and broker management
- **payroll_entries** - Driver payroll management
- **invoices** - Customer billing

### Supporting Tables
- **tenant_usage** - Usage tracking for billing
- **payroll_periods** - Weekly payroll periods
- **documents** - File storage metadata (S3 integration)
- **audit_logs** - Complete audit trail
- **tenant_settings** - Configurable settings per tenant

## Tenant Isolation Strategy

Every business table includes a `tenant_id` column that references the `tenants` table:

```sql
-- Example: All loads are isolated by tenant
SELECT * FROM loads WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440000';
```

### Row Level Security
Database policies automatically filter data by tenant:

```sql
-- Policy ensures users only see their tenant's data
CREATE POLICY tenant_isolation ON loads
    FOR ALL TO application_role
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## Subscription Tiers

| Feature | Starter | Professional | Enterprise |
|---------|---------|-------------|------------|
| Max Drivers | 5 | 25 | Unlimited |
| Max Trucks | 5 | 25 | Unlimited |
| Document Storage | 1GB | 10GB | Unlimited |
| API Calls/month | 10K | 100K | Unlimited |
| Advanced Reports | ❌ | ✅ | ✅ |
| White Label | ❌ | ❌ | ✅ |

## Setup Instructions

### 1. Create PostgreSQL Database
```bash
# On AWS RDS or local PostgreSQL
createdb absolute_tms_production
```

### 2. Run Schema
```bash
psql -d absolute_tms_production -f schema.sql
```

### 3. Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:5432/absolute_tms_production
TENANT_ISOLATION_ENABLED=true
```

## Usage Examples

### Creating a New Tenant
```sql
INSERT INTO tenants (name, slug, contact_email, subscription_plan)
VALUES ('ACME Trucking', 'acme', 'admin@acme.com', 'professional');
```

### Adding a User to Tenant
```sql
INSERT INTO users (tenant_id, email, first_name, last_name, role)
VALUES ('tenant-uuid', 'dispatcher@acme.com', 'John', 'Doe', 'dispatcher');
```

### Querying with Tenant Context
```sql
-- Set tenant context for session
SET app.current_tenant_id = '550e8400-e29b-41d4-a716-446655440000';

-- All queries automatically filter by tenant
SELECT * FROM loads WHERE status = 'in_transit';
```

## Migration Strategy

### From Single-Tenant to Multi-Tenant
1. **Backup existing data**
2. **Add tenant_id columns** to existing tables
3. **Create default tenant** for existing data
4. **Update all records** with default tenant_id
5. **Enable RLS policies**

### Data Migration Script
```sql
-- Add tenant_id to existing tables
ALTER TABLE existing_loads ADD COLUMN tenant_id UUID;

-- Create default tenant for existing data
INSERT INTO tenants (id, name, slug, contact_email)
VALUES ('default-tenant-id', 'Existing Customer', 'existing', 'admin@company.com');

-- Update existing records
UPDATE existing_loads SET tenant_id = 'default-tenant-id';
```

## Performance Considerations

### Indexes
- **All tenant_id columns are indexed** for fast filtering
- **Composite indexes** on tenant_id + frequently queried columns
- **Partial indexes** for common status queries

### Connection Pooling
- Use **PgBouncer** for connection pooling
- **Separate pools per tenant** for large customers
- **Prepared statements** for common queries

### Scaling
- **Read replicas** for reporting queries
- **Partitioning** by tenant_id for very large tables
- **Horizontal sharding** for enterprise customers

## Monitoring & Maintenance

### Usage Tracking
```sql
-- Monthly usage report
SELECT
    t.name,
    t.subscription_plan,
    u.loads_count,
    u.drivers_count,
    u.storage_mb
FROM tenants t
JOIN tenant_usage u ON t.id = u.tenant_id
WHERE u.month_year = '2024-01';
```

### Performance Monitoring
- **Query performance** tracking
- **Connection pool** monitoring
- **Disk usage** by tenant
- **Slow query** identification

## Next Steps

1. **Deploy to AWS RDS** PostgreSQL
2. **Set up FastAPI** with tenant middleware
3. **Implement authentication** with tenant context
4. **Add Stripe integration** for billing
5. **Create admin dashboard** for tenant management

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never bypass tenant isolation** in application code
2. **Always set tenant context** before database queries
3. **Validate tenant access** in API middleware
4. **Encrypt sensitive PII** data
5. **Regular security audits** of RLS policies

## Support

For questions about the database schema or multi-tenant implementation, contact the development team.