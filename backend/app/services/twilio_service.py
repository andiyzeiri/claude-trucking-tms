"""
Twilio service for sending SMS and emails to drivers
"""
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from typing import Optional, Dict, Any
import os
from app.config import settings


class TwilioService:
    """Service for handling Twilio SMS and email notifications"""

    def __init__(self):
        """Initialize Twilio client with credentials from environment"""
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.phone_number = settings.TWILIO_PHONE_NUMBER
        self.email_from = settings.TWILIO_EMAIL_FROM

        if not all([self.account_sid, self.auth_token]):
            raise ValueError("Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN")

        self.client = Client(self.account_sid, self.auth_token)

    async def send_sms(
        self,
        to_phone: str,
        message: str,
        media_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS message to a phone number

        Args:
            to_phone: Phone number in E.164 format (e.g., +1234567890)
            message: Message content
            media_url: Optional URL to media (MMS)

        Returns:
            Dictionary with status and message_sid or error
        """
        try:
            # Ensure phone number is in E.164 format
            if not to_phone.startswith('+'):
                # Assume US number if no country code
                to_phone = f'+1{to_phone.replace("-", "").replace("(", "").replace(")", "").replace(" ", "")}'

            message_params = {
                'body': message,
                'from_': self.phone_number,
                'to': to_phone
            }

            if media_url:
                message_params['media_url'] = [media_url]

            message_response = self.client.messages.create(**message_params)

            return {
                'success': True,
                'message_sid': message_response.sid,
                'status': message_response.status,
                'to': to_phone
            }
        except TwilioRestException as e:
            return {
                'success': False,
                'error': str(e),
                'error_code': e.code,
                'to': to_phone
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'to': to_phone
            }

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send email using Twilio SendGrid

        Args:
            to_email: Recipient email address
            subject: Email subject
            body: Plain text email body
            html_body: Optional HTML email body

        Returns:
            Dictionary with status and message_id or error
        """
        try:
            from twilio.rest.api.v2010.account.message import MessageInstance

            # Note: For email, you'll need SendGrid integration
            # Twilio SMS API doesn't directly support email
            # You would typically use Twilio's SendGrid service separately

            # This is a placeholder - you'll need to implement SendGrid
            return {
                'success': False,
                'error': 'Email sending requires SendGrid integration. Use send_sms for SMS notifications.'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def send_load_assignment_sms(
        self,
        driver_phone: str,
        driver_name: str,
        load_number: str,
        pickup_location: str,
        delivery_location: str,
        pickup_date: str
    ) -> Dict[str, Any]:
        """
        Send load assignment notification to driver

        Args:
            driver_phone: Driver's phone number
            driver_name: Driver's name
            load_number: Load number
            pickup_location: Pickup location
            delivery_location: Delivery location
            pickup_date: Pickup date

        Returns:
            Dictionary with status
        """
        message = f"""
Hi {driver_name},

You've been assigned to Load #{load_number}

📍 Pickup: {pickup_location}
📍 Delivery: {delivery_location}
📅 Pickup Date: {pickup_date}

Please check your TMS dashboard for full details.
        """.strip()

        return await self.send_sms(driver_phone, message)

    async def send_load_update_sms(
        self,
        driver_phone: str,
        driver_name: str,
        load_number: str,
        update_message: str
    ) -> Dict[str, Any]:
        """
        Send load update notification to driver

        Args:
            driver_phone: Driver's phone number
            driver_name: Driver's name
            load_number: Load number
            update_message: Update details

        Returns:
            Dictionary with status
        """
        message = f"""
Hi {driver_name},

Update for Load #{load_number}:

{update_message}

Check your TMS dashboard for details.
        """.strip()

        return await self.send_sms(driver_phone, message)

    async def send_bulk_sms(
        self,
        recipients: list[Dict[str, str]],
        message_template: str
    ) -> Dict[str, Any]:
        """
        Send SMS to multiple recipients

        Args:
            recipients: List of dicts with 'phone' and optional 'name' keys
            message_template: Message template (can include {name} placeholder)

        Returns:
            Dictionary with results for each recipient
        """
        results = []

        for recipient in recipients:
            phone = recipient.get('phone')
            name = recipient.get('name', '')

            if not phone:
                results.append({
                    'success': False,
                    'error': 'Phone number missing',
                    'recipient': recipient
                })
                continue

            # Replace {name} placeholder if present
            message = message_template.replace('{name}', name)

            result = await self.send_sms(phone, message)
            result['recipient'] = recipient
            results.append(result)

        return {
            'total': len(recipients),
            'successful': sum(1 for r in results if r.get('success')),
            'failed': sum(1 for r in results if not r.get('success')),
            'results': results
        }


# Singleton instance
_twilio_service: Optional[TwilioService] = None


def get_twilio_service() -> TwilioService:
    """Get or create Twilio service singleton"""
    global _twilio_service

    if _twilio_service is None:
        _twilio_service = TwilioService()

    return _twilio_service
