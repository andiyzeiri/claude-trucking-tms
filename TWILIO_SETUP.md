# Twilio Integration Setup Guide

Complete guide for setting up Twilio SMS and email notifications for drivers.

## Overview

The TMS now includes Twilio integration for sending:
- **SMS notifications** to drivers about load assignments, updates, and custom messages
- **Bulk SMS** to multiple drivers at once
- Automated load assignment notifications
- Load update notifications

## 1. Get Twilio Account

### Sign Up for Twilio
1. Go to [https://www.twilio.com/](https://www.twilio.com/)
2. Sign up for a free account (includes trial credits)
3. Verify your email and phone number

### Get Your Credentials
Once logged in, go to the Twilio Console:

1. **Account SID**: Found on your console dashboard
2. **Auth Token**: Found on your console dashboard (click to reveal)
3. **Phone Number**:
   - Go to Phone Numbers → Manage → Active numbers
   - Or purchase a new phone number:
     - Phone Numbers → Buy a number
     - Select a number with SMS capabilities
     - Purchase it (trial accounts get one free number)

## 2. Environment Variables

Add these to your backend `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Example `.env` file:
```bash
# Existing variables...
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...

# Add Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

### Important Notes:
- `TWILIO_PHONE_NUMBER` must include country code (e.g., +1 for US)
- Keep your Auth Token secret (never commit to git)
- For production, use AWS Secrets Manager or similar

## 3. Install Dependencies

On your backend server:

```bash
cd backend
pip install -r requirements.txt
```

This will install `twilio==9.0.0` along with other dependencies.

## 4. Restart Backend

After adding environment variables:

```bash
# If running locally
pkill -f uvicorn
python -m uvicorn app.main:app --reload

# If running with Docker
docker-compose restart backend

# If running on AWS ECS
# Redeploy the service or restart the task
```

## 5. Verify Configuration

Test your Twilio setup:

```bash
curl -X GET "http://localhost:8000/api/v1/notifications/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response should show:
```json
{
  "configured": true,
  "phone_number": "+15551234567",
  "account_sid": "AC123456..."
}
```

## 6. API Endpoints

### Available Endpoints

#### 1. Send Custom SMS to Driver
```bash
POST /api/v1/notifications/drivers/{driver_id}/notify
Query Params: message=Your message here
```

Example:
```bash
curl -X POST "http://localhost:8000/api/v1/notifications/drivers/1/notify?message=Hello Driver!" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 2. Send Load Assignment Notification
```bash
POST /api/v1/notifications/loads/assignment
Body: {
  "driver_id": 1,
  "load_id": 123
}
```

This automatically formats a message with:
- Driver name
- Load number
- Pickup location
- Delivery location
- Pickup date

#### 3. Send Load Update Notification
```bash
POST /api/v1/notifications/loads/update
Body: {
  "driver_id": 1,
  "load_id": 123,
  "update_message": "Pickup time changed to 2:00 PM"
}
```

#### 4. Send Bulk SMS to All Drivers
```bash
POST /api/v1/notifications/drivers/notify-all
Query Params: message=Company announcement
```

Message can include `{name}` placeholder which will be replaced with each driver's name.

#### 5. Send Custom SMS (Direct)
```bash
POST /api/v1/notifications/sms/send
Body: {
  "to_phone": "+15551234567",
  "message": "Your custom message"
}
```

#### 6. Send Bulk SMS (Custom Recipients)
```bash
POST /api/v1/notifications/sms/bulk
Body: {
  "recipients": [
    {"phone": "+15551234567", "name": "John Doe"},
    {"phone": "+15559876543", "name": "Jane Smith"}
  ],
  "message": "Hi {name}, this is a test message!"
}
```

## 7. Frontend Usage

### Using the Notification Panel Component

The `NotificationPanel` component is available to send notifications from the UI:

```tsx
import NotificationPanel from '@/components/notifications/NotificationPanel'

// In your component
<NotificationPanel
  driverId={driver.id}
  driverName={`${driver.first_name} ${driver.last_name}`}
  loadId={load.id}
  loadNumber={load.load_number}
/>
```

### Features:
- **Custom Message**: Send any text message to the driver
- **Load Assignment**: Automatically formatted load assignment notification
- **Load Update**: Send updates about specific loads
- Character counter (1600 character SMS limit)
- Success/error toast notifications

### Example Integration in Loads Page:

```tsx
import NotificationPanel from '@/components/notifications/NotificationPanel'

// In your loads table row
<td className="px-3 py-2.5">
  <NotificationPanel
    driverId={load.driver_id}
    driverName={load.driver ? `${load.driver.first_name} ${load.driver.last_name}` : undefined}
    loadId={load.id}
    loadNumber={load.load_number}
  />
</td>
```

## 8. Message Templates

### Load Assignment Template
```
Hi [Driver Name],

You've been assigned to Load #[Load Number]

📍 Pickup: [Pickup Location]
📍 Delivery: [Delivery Location]
📅 Pickup Date: [Pickup Date]

Please check your TMS dashboard for full details.
```

### Load Update Template
```
Hi [Driver Name],

Update for Load #[Load Number]:

[Your Update Message]

Check your TMS dashboard for details.
```

## 9. Testing

### Test with Twilio Trial Account

With a trial account:
1. You can only send SMS to **verified phone numbers**
2. To verify a number: Console → Verified Caller IDs → Add
3. Messages will include "Sent from your Twilio trial account" prefix
4. Once you upgrade, this prefix is removed

### Test Checklist:
- [ ] Send test SMS to yourself
- [ ] Send load assignment notification
- [ ] Send load update notification
- [ ] Test bulk SMS to multiple drivers
- [ ] Verify character limits (1600 max)
- [ ] Test with various phone formats (with/without country code)

### Example Test Script:
```python
import requests

API_URL = "http://localhost:8000/api/v1"
TOKEN = "your_jwt_token_here"

headers = {
    "Authorization": f"Bearer {TOKEN}"
}

# Test 1: Send custom SMS
response = requests.post(
    f"{API_URL}/notifications/drivers/1/notify",
    params={"message": "Test notification from TMS!"},
    headers=headers
)
print(response.json())

# Test 2: Send load assignment
response = requests.post(
    f"{API_URL}/notifications/loads/assignment",
    json={"driver_id": 1, "load_id": 1},
    headers=headers
)
print(response.json())
```

## 10. Production Deployment

### AWS Secrets Manager (Recommended)

Store Twilio credentials in AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
    --name twilio-credentials \
    --secret-string '{"TWILIO_ACCOUNT_SID":"ACxxxx","TWILIO_AUTH_TOKEN":"xxxx","TWILIO_PHONE_NUMBER":"+1234567890"}'
```

### ECS Task Definition

Add to your ECS task definition:

```json
{
  "secrets": [
    {
      "name": "TWILIO_ACCOUNT_SID",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:twilio-credentials:TWILIO_ACCOUNT_SID::"
    },
    {
      "name": "TWILIO_AUTH_TOKEN",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:twilio-credentials:TWILIO_AUTH_TOKEN::"
    },
    {
      "name": "TWILIO_PHONE_NUMBER",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:twilio-credentials:TWILIO_PHONE_NUMBER::"
    }
  ]
}
```

## 11. Cost Considerations

### Twilio Pricing (as of 2024)
- **SMS (US/Canada)**: ~$0.0079 per message
- **Trial Account**: $15.50 in free credits
- **Phone Number**: $1.00/month
- **MMS**: ~$0.02 per message

### Cost Estimation:
- 100 SMS/day = ~$0.79/day = ~$24/month
- 500 SMS/day = ~$4/day = ~$120/month
- 1000 SMS/day = ~$8/day = ~$240/month

### Tips to Reduce Costs:
1. Only send notifications when necessary
2. Use bulk SMS for group notifications
3. Implement message throttling
4. Track usage with Twilio console
5. Set up billing alerts

## 12. Troubleshooting

### Common Issues:

#### 1. "Twilio credentials not configured"
- **Solution**: Check that all 3 environment variables are set
- Run: `env | grep TWILIO` to verify

#### 2. "Failed to send SMS"
- **Solution**: Check phone number format (+1234567890)
- Verify phone number is verified (trial accounts)
- Check Twilio console logs for detailed error

#### 3. "Driver has no phone number on file"
- **Solution**: Add phone number to driver record in database
- Go to Drivers page → Edit driver → Add phone

#### 4. "The number +1234567890 is unverified"
- **Solution (Trial)**: Add number to verified caller IDs
- **Solution (Production)**: Upgrade to paid account

#### 5. Rate limiting errors
- **Solution**: Twilio has rate limits on trial accounts
- Upgrade to paid account for higher limits
- Implement message queuing for bulk sends

### Debug Mode:

Check Twilio service logs:
```python
# In app/services/twilio_service.py
# Add logging to debug issues
import logging
logger = logging.getLogger(__name__)
logger.error(f"Twilio error: {error}")
```

### Check Twilio Logs:
1. Go to Twilio Console
2. Monitor → Logs → Messaging
3. View detailed logs for each message
4. Check error codes and descriptions

## 13. Security Best Practices

1. **Never commit credentials to git**
   - Add `.env` to `.gitignore`
   - Use environment variables or secrets manager

2. **Rotate credentials regularly**
   - Change Auth Token every 90 days
   - Update in all environments

3. **Restrict API access**
   - Use IP allow lists in Twilio console
   - Implement rate limiting on endpoints
   - Require authentication for all notification endpoints

4. **Monitor usage**
   - Set up billing alerts in Twilio
   - Monitor for unusual activity
   - Track API usage patterns

5. **Validate phone numbers**
   - Use Twilio Lookup API to validate numbers
   - Sanitize input to prevent injection

## 14. Additional Features

### Future Enhancements:
- [ ] Delivery receipts and read confirmations
- [ ] Scheduled messages
- [ ] SMS templates with variables
- [ ] Two-way SMS (driver responses)
- [ ] MMS support (images, PDFs)
- [ ] WhatsApp notifications
- [ ] Voice calls for urgent notifications

### SendGrid Integration (Email):
For email notifications, integrate Twilio SendGrid:
1. Sign up for SendGrid
2. Get API key
3. Use SendGrid SDK instead of SMS API
4. Similar setup to Twilio SMS

## 15. Support

### Resources:
- Twilio Docs: https://www.twilio.com/docs
- Twilio Console: https://console.twilio.com
- Twilio Support: https://support.twilio.com
- Python SDK Docs: https://www.twilio.com/docs/libraries/python

### Need Help?
- Check Twilio Console logs first
- Review error messages in application logs
- Contact Twilio support for account-specific issues
- Check API status: https://status.twilio.com

---

**Congratulations!** 🎉

Your TMS now has full SMS notification capabilities. Start sending load assignments and updates to your drivers instantly!
