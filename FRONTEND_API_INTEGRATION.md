# Frontend API Integration Plan

## Current Status
✅ Backend is deployed and running at http://18.212.79.137:8000
✅ Authentication is working (register, login, email verification)
✅ User can log in successfully
❌ Frontend is still using hardcoded demo data instead of fetching from API

## What Needs to Be Done

The frontend needs to be updated to fetch real data from the backend API instead of using hardcoded mock data. Here are the main areas:

### 1. Dashboard (`frontend/src/app/dashboard/page.tsx`)
**Current**: Hardcoded static data (lines 30-115)
**Needs**:
- Fetch loads from `/api/v1/loads`
- Fetch drivers from `/api/v1/drivers`
- Fetch trucks from `/api/v1/trucks`
- Fetch customers from `/api/v1/customers`
- Calculate real statistics from API data

### 2. Loads Page
**Needs**:
- Fetch all loads: `GET /api/v1/loads`
- Create load: `POST /api/v1/loads`
- Update load: `PUT /api/v1/loads/{id}`
- Delete load: `DELETE /api/v1/loads/{id}`

### 3. Drivers Page
**Needs**:
- Fetch all drivers: `GET /api/v1/drivers`
- Create driver: `POST /api/v1/drivers`
- Update driver: `PUT /api/v1/drivers/{id}`
- Delete driver: `DELETE /api/v1/drivers/{id}`

### 4. Trucks Page
**Needs**:
- Fetch all trucks: `GET /api/v1/trucks`
- Create truck: `POST /api/v1/trucks`
- Update truck: `PUT /api/v1/trucks/{id}`
- Delete truck: `DELETE /api/v1/trucks/{id}`

### 5. Customers Page
**Needs**:
- Fetch all customers: `GET /api/v1/customers`
- Create customer: `POST /api/v1/customers`
- Update customer: `PUT /api/v1/customers/{id}`
- Delete customer: `DELETE /api/v1/customers/{id}`

### 6. Invoices Page
**Needs**:
- Fetch all invoices: `GET /api/v1/invoices`
- Create invoice: `POST /api/v1/invoices`
- Update invoice: `PUT /api/v1/invoices/{id}`
- Delete invoice: `DELETE /api/v1/invoices/{id}`

## Implementation Approach

### Step 1: Create API Hook Files
Create custom hooks for each entity using React Query:

```typescript
// frontend/src/hooks/use-loads.ts
export function useLoads() {
  return useQuery({
    queryKey: ['loads'],
    queryFn: async () => {
      const response = await api.get('/v1/loads')
      return response.data
    }
  })
}

export function useCreateLoad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data) => {
      const response = await api.post('/v1/loads', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['loads'])
    }
  })
}
```

### Step 2: Update Dashboard
Replace hardcoded data with API calls:

```typescript
// frontend/src/app/dashboard/page.tsx
import { useLoads } from '@/hooks/use-loads'
import { useDrivers } from '@/hooks/use-drivers'

export default function DashboardPage() {
  const { data: loads, isLoading: loadsLoading } = useLoads()
  const { data: drivers, isLoading: driversLoading } = useDrivers()

  // Use real data instead of hardcoded
  const statisticsData = {
    loads: loads?.length || 0,
    drivers: drivers?.length || 0,
    // ...
  }
}
```

### Step 3: Update Each Page
Follow the same pattern for:
- Loads page
- Drivers page
- Trucks page
- Customers page
- Invoices page

## Quick Start: Minimal Working Version

To get started quickly, update just the dashboard to show real empty state:

```typescript
// frontend/src/app/dashboard/page.tsx
const { data: user } = useAuth()

return (
  <Layout>
    <div className="p-6">
      <h1>Welcome, {user?.first_name}!</h1>
      <p>Your company: {user?.company_id}</p>
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="font-semibold">Getting Started</h2>
        <p>Add your first load, driver, or truck to get started!</p>
      </div>
    </div>
  </Layout>
)
```

## Testing the API Endpoints

You can test that endpoints are working using curl:

```bash
# Get auth token (save from login response)
TOKEN="your_access_token_here"

# Test loads endpoint
curl -H "Authorization: Bearer $TOKEN" http://18.212.79.137:8000/api/v1/loads

# Test drivers endpoint
curl -H "Authorization: Bearer $TOKEN" http://18.212.79.137:8000/api/v1/drivers

# Test trucks endpoint
curl -H "Authorization: Bearer $TOKEN" http://18.212.79.137:8000/api/v1/trucks
```

## Next Steps

1. **Priority 1**: Update dashboard to show empty state with real user info
2. **Priority 2**: Create one complete CRUD flow (e.g., Loads)
3. **Priority 3**: Replicate pattern for other entities
4. **Priority 4**: Add loading states and error handling
5. **Priority 5**: Add optimistic updates for better UX

## Notes

- The backend API requires authentication for all data endpoints
- JWT token is stored in cookies by the auth hook
- All endpoints support filtering by company_id (multi-tenant)
- Backend already has proper error handling and validation
