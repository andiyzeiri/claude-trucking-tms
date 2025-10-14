# Twilio Quick Start - 5 Minute Setup

Get SMS notifications working in 5 minutes!

## Step 1: Get Twilio Account (2 minutes)

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (free trial with $15.50 credits)
3. Verify your email and phone number

## Step 2: Get Your Credentials (1 minute)

From the Twilio Console Dashboard (https://console.twilio.com/):

1. Copy your **Account SID** (starts with "AC")
2. Copy your **Auth Token** (click the eye icon to reveal)
3. Get a phone number:
   - Click "Get a Trial Number" or
   - Go to Phone Numbers → Buy a number → Search for number with SMS

## Step 3: Add to Environment Variables (1 minute)

Edit your backend `.env` file:

```bash
cd /home/andi/claude-trucking-tms/backend
nano .env  # or vi .env
```

Add these lines:
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

**Replace** with your actual values from Twilio Console!

## Step 4: Install & Restart (1 minute)

```bash
# Install Twilio SDK
pip install twilio==9.0.0

# Restart backend
pkill -f uvicorn
python -m uvicorn app.main:app --reload --port 8000
```

## Step 5: Test It! (30 seconds)

Send a test SMS using curl:

```bash
curl -X POST "http://localhost:8000/api/v1/notifications/sms/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "to_phone": "+YOUR_VERIFIED_PHONE",
    "message": "Test from TMS!"
  }'
```

**Note**: With trial account, you can only send to verified numbers. Verify your phone in Twilio Console first.

## What You Can Do Now

### 1. Send SMS to Driver
```bash
POST /api/v1/notifications/drivers/{driver_id}/notify?message=Hello!
```

### 2. Notify Load Assignment
```bash
POST /api/v1/notifications/loads/assignment
Body: {"driver_id": 1, "load_id": 123}
```

### 3. Send Load Update
```bash
POST /api/v1/notifications/loads/update
Body: {
  "driver_id": 1,
  "load_id": 123,
  "update_message": "Pickup time changed"
}
```

### 4. Bulk SMS to All Drivers
```bash
POST /api/v1/notifications/drivers/notify-all?message=Company announcement!
```

## Using the UI Component

Import and use the NotificationPanel in your React components:

```tsx
import NotificationPanel from '@/components/notifications/NotificationPanel'

<NotificationPanel
  driverId={driver.id}
  driverName="John Doe"
  loadId={load.id}
  loadNumber="LOAD-123"
/>
```

This adds a message icon button that opens a dialog with:
- Custom message input
- Load assignment template
- Load update template

## Trial Account Limitations

- Can only SMS **verified phone numbers**
  - Verify at: Console → Verified Caller IDs
- Messages include "Sent from your Twilio trial account" prefix
- Limited to 1 phone number (free)
- $15.50 in credits (~2,000 SMS messages)

## Upgrade to Production

When ready for production:

1. **Upgrade Account**: Console → Billing → Upgrade
2. **Remove Trial Restrictions**: Send to any number
3. **Remove Trial Prefix**: Clean messages
4. **Higher Limits**: Increased rate limits
5. **More Numbers**: Purchase additional numbers

## Costs

- SMS (US): $0.0079 per message
- Phone Number: $1.00/month
- 100 SMS/day = ~$24/month
- 500 SMS/day = ~$120/month

## Troubleshooting

### "Twilio credentials not configured"
→ Check `.env` file has all 3 variables

### "The number is unverified"
→ Add to verified numbers in Twilio Console (trial only)

### "Driver has no phone number"
→ Add phone number to driver in TMS

### Still stuck?
→ See full guide: `TWILIO_SETUP.md`

---

**That's it!** 🚀 You're now sending SMS notifications to drivers!

Check the full setup guide in `TWILIO_SETUP.md` for advanced features, production deployment, and troubleshooting.
