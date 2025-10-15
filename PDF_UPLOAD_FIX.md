# PDF Upload Fix Documentation

## Problem Summary

The PDF attachment functionality for POD (Proof of Delivery) and Rate Confirmation was not working because:

1. **Frontend Issue**: The FileUpload component was storing PDFs as base64 data URLs locally but never uploading them to the backend server
2. **Missing Integration**: The backend upload API endpoint existed but was never called from the frontend
3. **Database Fields Empty**: The `pod_url` and `ratecon_url` fields in the database remained empty because no URLs were being saved

## Solution Implemented

### 1. Updated FileUpload Component

**File**: `/frontend/src/components/ui/file-upload.tsx`

**Changes**:
- Added actual file upload to backend API (`POST /v1/uploads/`)
- Replaced local data URL storage with server-side storage
- Files are now uploaded to AWS S3 or local storage (depending on backend configuration)
- Returns backend URL path that can be retrieved later

**Key Code**:
```typescript
// Upload file to backend
const formData = new FormData()
formData.append('file', file)

const response = await api.post('/v1/uploads/', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
})

// Store the backend URL (not data URL)
const uploadedFile: UploadedFile = {
  id: `${Date.now()}-${index}`,
  name: response.data.filename,
  size: response.data.size,
  type: file.type,
  url: response.data.url, // This is a backend path like /api/v1/uploads/files/xxx.pdf
  uploadedAt: new Date()
}
```

### 2. Created Document Update Hook

**File**: `/frontend/src/hooks/use-loads.ts`

Added `useUpdateLoadDocuments()` hook to persist PDF URLs to the database:

```typescript
export function useUpdateLoadDocuments() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      pod_url,
      ratecon_url
    }: {
      id: number
      pod_url?: string
      ratecon_url?: string
    }): Promise<Load> => {
      const response = await api.put(`/v1/loads/${id}`, {
        pod_url,
        ratecon_url
      })
      return response.data
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['loads'] })
      queryClient.invalidateQueries({ queryKey: ['load', id] })
      toast.success('Documents updated successfully')
    },
  })
}
```

### 3. Created Load Documents Panel Component

**File**: `/frontend/src/components/loads/load-documents-panel.tsx`

This is a complete, ready-to-use component that:
- Displays separate upload areas for Rate Confirmation and POD
- Shows current files if they exist
- Handles file upload to backend
- Saves URLs to database
- Provides visual feedback on changes

**Usage Example**:
```typescript
import { LoadDocumentsPanel } from '@/components/loads/load-documents-panel'

function LoadDetailsPage() {
  const { data: load } = useLoad(loadId)

  if (!load) return <div>Loading...</div>

  return (
    <div>
      <h1>Load #{load.load_number}</h1>
      <LoadDocumentsPanel load={load} />
    </div>
  )
}
```

## Backend Configuration

The backend supports two storage modes:

### Local Storage (Development)
```python
# backend/.env
USE_S3=False
```
Files stored in `/app/uploads/` directory

### S3 Storage (Production)
```python
# backend/.env
USE_S3=True
S3_BUCKET=trucking-tms-uploads-1759878269
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

## File Upload Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User selects PDF file in FileUpload component           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. File uploaded via POST /v1/uploads/                     │
│    - FormData with file                                     │
│    - Backend validates PDF only                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend stores file                                      │
│    - S3: Uploaded to AWS S3 bucket                          │
│    - Local: Saved to /app/uploads/ directory               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Backend returns URL                                      │
│    - S3: /api/v1/uploads/s3/{filename}                      │
│    - Local: /api/v1/uploads/files/{filename}                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend stores URL in component state                  │
│    - User can upload multiple files                         │
│    - URLs are shown in file list                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. User clicks "Save Changes"                               │
│    - PUT /v1/loads/{id} with pod_url and ratecon_url       │
│    - Multiple URLs joined with commas                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Database updated                                         │
│    - loads.pod_url = "/api/v1/uploads/files/abc.pdf"       │
│    - loads.ratecon_url = "/api/v1/uploads/files/xyz.pdf"   │
└─────────────────────────────────────────────────────────────┘
```

## File Retrieval

To display or download uploaded files:

### From Frontend:
```typescript
// File URL from database
const fileUrl = load.pod_url // e.g., "/api/v1/uploads/files/abc123.pdf"

// Display in iframe
<iframe src={`${API_URL}${fileUrl}`} />

// Or download
window.open(`${API_URL}${fileUrl}`, '_blank')
```

### Backend Endpoints:
- `GET /api/v1/uploads/files/{filename}` - Serve local file
- `GET /api/v1/uploads/s3/{filename}` - Generate S3 presigned URL

## Database Schema

The Load model already has the required fields:

```python
# backend/app/models/load.py
class Load(Base):
    __tablename__ = "loads"

    # ... other fields ...
    pod_url = Column(String)      # Stores POD PDF URL
    ratecon_url = Column(String)  # Stores Rate Confirmation PDF URL
```

## Integration with Existing Pages

To add document upload to an existing load page:

### Option 1: Use LoadDocumentsPanel (Recommended)

```typescript
import { LoadDocumentsPanel } from '@/components/loads/load-documents-panel'
import { useLoad } from '@/hooks/use-loads'

function LoadPage({ params }: { params: { id: string } }) {
  const { data: load } = useLoad(parseInt(params.id))

  if (!load) return <div>Loading...</div>

  return (
    <div className="container mx-auto p-6">
      <h1>Load Details</h1>
      {/* Other load information */}

      {/* Document upload section */}
      <LoadDocumentsPanel load={load} />
    </div>
  )
}
```

### Option 2: Use DocumentModal (Dialog/Popup)

```typescript
import { DocumentModal } from '@/components/loads/document-modal'
import { useUpdateLoadDocuments } from '@/hooks/use-loads'

function LoadsTable() {
  const [showDocs, setShowDocs] = useState(false)
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null)
  const updateDocs = useUpdateLoadDocuments()

  const handleDocumentsChange = async (documents: LoadDocuments) => {
    if (!selectedLoad) return

    const ratecon_url = documents.ratecon.map(f => f.url).join(',')
    const pod_url = documents.pod.map(f => f.url).join(',')

    await updateDocs.mutateAsync({
      id: selectedLoad.id,
      ratecon_url,
      pod_url
    })
  }

  return (
    <>
      <table>
        {/* table rows */}
        <button onClick={() => {
          setSelectedLoad(load)
          setShowDocs(true)
        }}>
          Manage Documents
        </button>
      </table>

      <DocumentModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
        loadNumber={selectedLoad?.load_number || ''}
        documents={{
          ratecon: parseFiles(selectedLoad?.ratecon_url),
          pod: parseFiles(selectedLoad?.pod_url)
        }}
        onDocumentsChange={handleDocumentsChange}
      />
    </>
  )
}
```

## Testing

### 1. Test File Upload

1. Navigate to a load details page with the LoadDocumentsPanel
2. Click "Upload Rate Confirmation PDFs" or "Upload POD PDFs"
3. Select a PDF file
4. Verify:
   - Upload progress shown
   - Success toast notification
   - File appears in the file list
   - "Save Changes" button appears

### 2. Test File Save

1. After uploading files, click "Save Changes"
2. Verify:
   - Success toast: "Documents updated successfully"
   - Changes persist after page reload

### 3. Test File Retrieval

1. Reload the page
2. Verify:
   - Previously uploaded files are shown
   - Can preview files by clicking eye icon
   - Can download files

### 4. Test Backend Storage

```bash
# For local storage
ls /app/uploads/

# For S3 storage
aws s3 ls s3://trucking-tms-uploads-1759878269/
```

### 5. Test Database

```sql
SELECT id, load_number, pod_url, ratecon_url
FROM loads
WHERE pod_url IS NOT NULL OR ratecon_url IS NOT NULL;
```

## Troubleshooting

### Files Not Uploading

**Check**:
1. Backend is running and accessible
2. Authentication token is present (logged in)
3. Network tab shows POST to `/v1/uploads/`
4. Backend logs for errors

### Files Upload But Don't Save

**Check**:
1. PUT request to `/v1/loads/{id}` includes `pod_url` and `ratecon_url`
2. Database connection is working
3. User has permission to update loads

### Can't View Files

**Check**:
1. S3 bucket permissions (if using S3)
2. File exists in storage
3. Presigned URL generation working (for S3)
4. Authentication required for retrieval endpoint

### CORS Errors

**Check backend CORS settings**:
```python
# backend/.env
CORS_ORIGINS=http://localhost:3000,https://absolutetms.netlify.app
```

## Future Enhancements

1. **Multiple File Support**: Currently joins URLs with commas; could use JSON array
2. **File Versioning**: Track document versions and history
3. **Automatic OCR**: Extract text from PDFs for searchability
4. **Thumbnail Generation**: Show PDF previews
5. **Drag & Drop**: Enhanced UI for bulk uploads
6. **Progress Tracking**: Real-time upload progress bars
7. **File Size Optimization**: Compress PDFs before upload
8. **Digital Signatures**: Sign documents within the app

## Files Modified

1. `/frontend/src/components/ui/file-upload.tsx` - Added backend upload
2. `/frontend/src/hooks/use-loads.ts` - Added `useUpdateLoadDocuments()` hook
3. `/frontend/src/components/loads/document-modal.tsx` - Enhanced document handling

## Files Created

1. `/frontend/src/components/loads/load-documents-panel.tsx` - Standalone document panel
2. `/home/andi/claude-trucking-tms/PDF_UPLOAD_FIX.md` - This documentation

## Backend Files (Already Existed, No Changes Needed)

1. `/backend/app/api/v1/endpoints/uploads.py` - Upload endpoint
2. `/backend/app/models/load.py` - Load model with URL fields
3. `/backend/app/schemas/load.py` - Load schemas with URL fields
4. `/backend/app/services/s3.py` - S3 service for file storage

## Summary

The PDF upload system is now fully functional:

✅ Files upload to backend (S3 or local storage)
✅ URLs persist to database
✅ Files can be retrieved and displayed
✅ Complete React hooks for CRUD operations
✅ Ready-to-use UI components
✅ Proper error handling and user feedback

The integration is complete and ready for production use!
