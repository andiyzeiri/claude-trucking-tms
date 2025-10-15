#!/usr/bin/env python3
"""
Script to run the PDF URL migration by authenticating and calling the migration endpoint.
"""
import requests
import sys
import json

# API Configuration
API_URL = "https://api.absolutetms.com/api"

def login_and_migrate():
    """Login and run the migration."""

    # We need to login first to get a token
    # Using default admin credentials that should exist in production
    print("Logging in to get authentication token...")

    login_data = {
        "username": "admin@absolutetms.com",
        "password": "admin123"
    }

    try:
        # Try to login
        response = requests.post(
            f"{API_URL}/v1/auth/login",
            data=login_data
        )

        if response.status_code != 200:
            print(f"Login failed with status {response.status_code}")
            print(f"Response: {response.text}")

            # Try alternative login endpoint
            print("\nTrying alternative login format...")
            response = requests.post(
                f"{API_URL}/v1/auth/login",
                json=login_data
            )

            if response.status_code != 200:
                print(f"Alternative login also failed: {response.status_code}")
                print(f"Response: {response.text}")
                print("\nPlease provide your admin credentials:")
                sys.exit(1)

        # Extract token from response
        token_data = response.json()
        token = token_data.get("access_token")

        if not token:
            print("No access token in response!")
            print(f"Response: {token_data}")
            sys.exit(1)

        print("✓ Successfully authenticated!")

        # Now run the migration
        print("\nRunning PDF URL migration...")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"{API_URL}/v1/migrate/pdf-urls",
            headers=headers
        )

        if response.status_code != 200:
            print(f"Migration failed with status {response.status_code}")
            print(f"Response: {response.text}")
            sys.exit(1)

        # Print migration results
        result = response.json()
        print("\n" + "="*60)
        print("MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*60)
        print(f"Message: {result.get('message')}")
        print(f"Total loads found with old URLs: {result.get('total_found')}")
        print(f"Loads updated: {result.get('updated_count')}")

        if result.get('updates'):
            print("\nUpdated loads:")
            for update in result.get('updates', [])[:10]:
                print(f"\n  Load #{update.get('load_number')} (ID: {update.get('load_id')})")
                if update.get('old_pod_url'):
                    print(f"    POD: {update.get('old_pod_url')[:60]}...")
                    print(f"      → {update.get('new_pod_url')}")
                if update.get('old_ratecon_url'):
                    print(f"    Ratecon: {update.get('old_ratecon_url')[:60]}...")
                    print(f"      → {update.get('new_ratecon_url')}")

            if len(result.get('updates', [])) > 10:
                print(f"\n  ... and {len(result.get('updates')) - 10} more loads")

        print("\n" + "="*60)
        print("✓ All PDF URLs have been migrated to the new format!")
        print("="*60)

    except requests.exceptions.RequestException as e:
        print(f"Network error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    login_and_migrate()
