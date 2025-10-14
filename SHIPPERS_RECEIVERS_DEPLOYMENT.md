# Shippers and Receivers Feature - Deployment Guide

## Overview
Added two new pages for managing warehouse and shipping location information:
- **Shippers**: Warehouse/pickup locations
- **Receivers**: Delivery/receiving locations

Also added **MC (Motor Carrier)** field to customers.

## Frontend Changes (✅ Complete)

### Files Created:
1. `/frontend/src/app/shippers/page.tsx` - Shipper management page
2. `/frontend/src/app/receivers/page.tsx` - Receiver management page
3. `/frontend/src/hooks/use-shippers.ts` - React Query hooks for shippers
4. `/frontend/src/hooks/use-receivers.ts` - React Query hooks for receivers

### Files Modified:
1. `/frontend/src/types/index.ts` - Added Shipper and Receiver interfaces, added mc field to Customer
2. `/frontend/src/components/layout/sidebar.tsx` - Added navigation links for Shippers and Receivers

### Features:
- Airtable-style inline editing (click to edit any cell)
- Auto-save on blur
- Alternating row backgrounds
- Add/delete functionality
- Full CRUD operations

## Backend Changes (✅ Complete)

### Files Created:
1. `/backend/app/models/shipper.py` - Shipper database model
2. `/backend/app/models/receiver.py` - Receiver database model
3. `/backend/app/schemas/shipper.py` - Shipper Pydantic schemas
4. `/backend/app/schemas/receiver.py` - Receiver Pydantic schemas
5. `/backend/app/api/v1/endpoints/shippers.py` - Shipper API endpoints
6. `/backend/app/api/v1/endpoints/receivers.py` - Receiver API endpoints
7. `/backend/alembic/versions/4a5c36df9be4_add_shippers_receivers_and_mc_field.py` - Alembic migration
8. `/backend/run_shippers_receivers_migration.py` - Python migration script
9. `/backend/add_shippers_receivers_mc.sql` - SQL migration script

### Files Modified:
1. `/backend/app/api/v1/api.py` - Registered shipper and receiver routes
2. `/backend/app/models/company.py` - Added relationships for shippers and receivers
3. `/backend/app/models/customer.py` - Added mc field
4. `/backend/app/schemas/customer.py` - Added mc field to schemas

## Database Migration (⚠️ Needs to be run on production)

### Option 1: Using SQL Script (Recommended)
Run this on your production database:
```bash
psql -U <username> -d <database> -f /home/andi/claude-trucking-tms/backend/add_shippers_receivers_mc.sql
```

### Option 2: Using Python Script
On the backend server:
```bash
cd /home/andi/claude-trucking-tms/backend
python run_shippers_receivers_migration.py
```

### Option 3: Using Alembic
If using Alembic:
```bash
cd /home/andi/claude-trucking-tms/backend
alembic upgrade head
```

## What the Migration Does:
1. ✅ Adds `mc` column to `customers` table (VARCHAR, nullable)
2. ✅ Creates `shippers` table with fields:
   - id (primary key)
   - name, address, city, state, zip_code
   - phone, contact_person, email
   - product_type, average_wait_time, appointment_type
   - notes, company_id (foreign key)
   - created_at, updated_at
3. ✅ Creates `receivers` table (same structure as shippers)
4. ✅ Creates indexes on id columns

## API Endpoints (Ready to use)

### Shippers:
- `GET /v1/shippers` - List all shippers (paginated)
- `GET /v1/shippers/{id}` - Get single shipper
- `POST /v1/shippers` - Create new shipper
- `PUT /v1/shippers/{id}` - Update shipper
- `DELETE /v1/shippers/{id}` - Delete shipper

### Receivers:
- `GET /v1/receivers` - List all receivers (paginated)
- `GET /v1/receivers/{id}` - Get single receiver
- `POST /v1/receivers` - Create new receiver
- `PUT /v1/receivers/{id}` - Update receiver
- `DELETE /v1/receivers/{id}` - Delete receiver

## Navigation
New menu items added to sidebar (with Warehouse icons):
- **Shippers** - Located between Customers and Expenses
- **Receivers** - Located right after Shippers

## Testing Checklist
After running the migration:

### Backend:
- [ ] Restart backend service
- [ ] Verify `/v1/shippers` endpoint returns empty array or data
- [ ] Verify `/v1/receivers` endpoint returns empty array or data
- [ ] Test creating a shipper via API
- [ ] Test creating a receiver via API
- [ ] Verify MC field appears in customer API responses

### Frontend:
- [ ] Navigate to /shippers - page loads without errors
- [ ] Navigate to /receivers - page loads without errors
- [ ] Click "New Shipper" - creates a new row
- [ ] Click any cell - enters edit mode
- [ ] Edit and blur - auto-saves
- [ ] Delete a shipper - removes from list
- [ ] Same tests for receivers
- [ ] Check that MC field displays under customer names in loads table

## Rollback (if needed)
To rollback the migration:

```sql
-- Remove receivers table
DROP INDEX IF EXISTS ix_receivers_id;
DROP TABLE IF EXISTS receivers;

-- Remove shippers table
DROP INDEX IF EXISTS ix_shippers_id;
DROP TABLE IF EXISTS shippers;

-- Remove MC field from customers
ALTER TABLE customers DROP COLUMN IF EXISTS mc;
```

## Notes
- All endpoints require authentication
- Data is scoped by `company_id` (multi-tenant)
- Inline editing auto-saves on blur
- No explicit "Save" button needed
- Alternating row colors for better readability
- Consistent styling with existing loads table
