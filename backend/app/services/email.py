from typing import Optional
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails"""

    def __init__(self):
        self.smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = getattr(settings, 'SMTP_PORT', 587)
        self.smtp_user = getattr(settings, 'SMTP_USER', None)
        self.smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
        self.ses_region = getattr(settings, 'SES_REGION', None) or getattr(settings, 'AWS_REGION', 'us-east-1')
        self.ses_from_email = getattr(settings, 'SES_FROM_EMAIL', None)
        self.from_email = self.ses_from_email or getattr(settings, 'FROM_EMAIL', None) or self.smtp_user
        self.from_name = getattr(settings, 'FROM_NAME', 'Claude Trucking TMS')

    def resolve_transport(self) -> str:
        """
        Decide how mail actually leaves the box.

        Returns one of 'ses', 'smtp' or 'console'. 'console' means nothing is
        sent - the message is logged instead. That is the safe default: an
        unconfigured deployment should never silently appear to be emailing
        people when it is not.
        """
        configured = (getattr(settings, 'EMAIL_TRANSPORT', 'auto') or 'auto').lower()

        if configured == 'ses':
            return 'ses'
        if configured == 'smtp':
            return 'smtp'
        if configured == 'console':
            return 'console'

        # auto
        if self.ses_from_email:
            return 'ses'
        if self.smtp_user and self.smtp_password:
            return 'smtp'
        return 'console'

    def _send_via_ses(self, to_email: str, subject: str, html_content: str,
                      text_content: Optional[str]) -> bool:
        """Send through AWS SES. boto3 is already a dependency."""
        import boto3

        client = boto3.client('ses', region_name=self.ses_region)
        body: dict = {'Html': {'Data': html_content, 'Charset': 'UTF-8'}}
        if text_content:
            body['Text'] = {'Data': text_content, 'Charset': 'UTF-8'}

        client.send_email(
            Source=f"{self.from_name} <{self.from_email}>",
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': body,
            },
        )
        return True

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send an email via whichever transport is configured."""
        try:
            transport = self.resolve_transport()

            if transport == 'ses':
                self._send_via_ses(to_email, subject, html_content, text_content)
                logger.info("email: sent to %s via SES (%s)", to_email, subject)
                return True

            # If SMTP is not configured, log the email instead
            if transport == 'console' or not self.smtp_user or not self.smtp_password:
                print(f"\n{'='*60}")
                print(f"EMAIL SERVICE (Development Mode - SMTP not configured)")
                print(f"{'='*60}")
                print(f"To: {to_email}")
                print(f"From: {self.from_name} <{self.from_email}>")
                print(f"Subject: {subject}")
                print(f"\n{'-'*60}")
                print("HTML Content:")
                print(f"{'-'*60}")
                print(html_content)
                print(f"{'='*60}\n")
                return True

            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email

            # Add text and HTML parts
            if text_content:
                part1 = MIMEText(text_content, 'plain')
                msg.attach(part1)

            part2 = MIMEText(html_content, 'html')
            msg.attach(part2)

            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            logger.info("email: sent to %s via SMTP (%s)", to_email, subject)
            return True
        except Exception as e:
            logger.exception("email: failed sending to %s (%s): %s", to_email, subject, e)
            return False

    async def send_verification_email(
        self,
        to_email: str,
        username: str,
        verification_token: str
    ) -> bool:
        """Send email verification email"""
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #2563eb;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Claude Trucking TMS</h1>
                </div>
                <div class="content">
                    <h2>Hello {username}!</h2>
                    <p>Thank you for registering with Claude Trucking TMS. Please verify your email address to complete your registration.</p>
                    <p>Click the button below to verify your email:</p>
                    <a href="{verification_url}" class="button">Verify Email Address</a>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #2563eb;">{verification_url}</p>
                    <p><strong>Note:</strong> This verification link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't create an account with Claude Trucking TMS, please ignore this email.</p>
                    <p>&copy; 2025 Claude Trucking TMS. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Welcome to Claude Trucking TMS

        Hello {username}!

        Thank you for registering with Claude Trucking TMS. Please verify your email address to complete your registration.

        Click or copy this link to verify your email:
        {verification_url}

        Note: This verification link will expire in 24 hours.

        If you didn't create an account with Claude Trucking TMS, please ignore this email.
        """

        return await self.send_email(
            to_email=to_email,
            subject="Verify Your Email - Claude Trucking TMS",
            html_content=html_content,
            text_content=text_content
        )

    async def send_welcome_email(
        self,
        to_email: str,
        username: str,
        company_name: str
    ) -> bool:
        """Send welcome email after verification"""
        login_url = f"{settings.FRONTEND_URL}/login"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #2563eb;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Email Verified Successfully!</h1>
                </div>
                <div class="content">
                    <h2>Welcome, {username}!</h2>
                    <p>Your email has been successfully verified. You can now access your Claude Trucking TMS account.</p>
                    <p><strong>Company:</strong> {company_name}</p>
                    <p>Click the button below to log in:</p>
                    <a href="{login_url}" class="button">Log In to Your Account</a>
                    <p>You can start managing your trucking operations right away:</p>
                    <ul>
                        <li>Manage loads and dispatches</li>
                        <li>Track drivers and trucks</li>
                        <li>Handle customer relationships</li>
                        <li>Generate invoices and reports</li>
                    </ul>
                </div>
                <div class="footer">
                    <p>Need help? Contact our support team.</p>
                    <p>&copy; 2025 Claude Trucking TMS. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to_email=to_email,
            subject="Welcome to Claude Trucking TMS!",
            html_content=html_content
        )

    async def send_user_invitation_email(
        self,
        to_email: str,
        invited_by: str,
        company_name: str,
        temporary_password: str,
        username: str
    ) -> bool:
        """Send invitation email to new user added by admin"""
        login_url = f"{settings.FRONTEND_URL}/login"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; }}
                .content {{ background-color: #f9fafb; padding: 30px; }}
                .credentials {{
                    background-color: #fff;
                    border: 2px solid #2563eb;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 5px;
                }}
                .button {{
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #2563eb;
                    color: white;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>You've Been Invited!</h1>
                </div>
                <div class="content">
                    <h2>Welcome to Claude Trucking TMS</h2>
                    <p>{invited_by} has invited you to join <strong>{company_name}</strong> on Claude Trucking TMS.</p>
                    <p>Your account has been created with the following credentials:</p>
                    <div class="credentials">
                        <p><strong>Username:</strong> {username}</p>
                        <p><strong>Temporary Password:</strong> {temporary_password}</p>
                    </div>
                    <p><strong>Important:</strong> Please change your password after your first login.</p>
                    <a href="{login_url}" class="button">Log In Now</a>
                </div>
                <div class="footer">
                    <p>If you didn't expect this invitation, please contact {company_name}.</p>
                    <p>&copy; 2025 Claude Trucking TMS. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(
            to_email=to_email,
            subject=f"Invitation to Join {company_name} - Claude Trucking TMS",
            html_content=html_content
        )


# Singleton instance
email_service = EmailService()
