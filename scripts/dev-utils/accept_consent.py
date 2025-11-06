"""
Helper script to accept legal consent for a user.

Usage:
    poetry run python accept_consent.py <email> [--password <password>]
"""

import argparse
import asyncio
from getpass import getpass

import httpx


async def accept_consent(email: str, password: str) -> None:
    """Accept legal consent for a user."""
    base_url = "http://localhost:8000/api/v1"

    async with httpx.AsyncClient() as client:
        # Step 1: Login to get token
        print(f"\n🔐 Logging in as {email}...")
        login_response = await client.post(
            f"{base_url}/auth/login",
            json={"email": email, "password": password},
        )

        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.text}")
            return

        tokens = login_response.json()
        access_token = tokens["access_token"]
        print("✅ Login successful")

        # Step 2: Get current legal documents
        print("\n📄 Fetching current legal documents...")
        docs_response = await client.get(f"{base_url}/legal/documents")

        if docs_response.status_code != 200:
            print(f"❌ Failed to fetch documents: {docs_response.text}")
            return

        documents = docs_response.json()
        print(f"✅ Found {len(documents)} published documents")

        # Find Terms of Service and Privacy Policy
        tos_doc = next(
            (d for d in documents if d["document_type"] == "terms_of_service"), None
        )
        privacy_doc = next(
            (d for d in documents if d["document_type"] == "privacy_policy"), None
        )

        if not tos_doc or not privacy_doc:
            print("❌ Terms of Service or Privacy Policy not found")
            return

        print(f"   - Terms of Service v{tos_doc['version']}")
        print(f"   - Privacy Policy v{privacy_doc['version']}")

        # Step 3: Accept consent
        print("\n✍️  Accepting legal documents...")
        consent_response = await client.post(
            f"{base_url}/consent/accept",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "tos_document_id": tos_doc["id"],
                "privacy_document_id": privacy_doc["id"],
            },
        )

        if consent_response.status_code == 201:
            consent = consent_response.json()
            print("✅ Legal consent accepted successfully!")
            print("\n📋 Consent Details:")
            print(f"   - ToS Version: {consent['tos_version']}")
            print(f"   - Privacy Version: {consent['privacy_version']}")
            print(f"   - Accepted At: {consent['accepted_at']}")
            print("\n🎉 You can now use all platform features!")
        else:
            print(f"❌ Failed to accept consent: {consent_response.text}")


def main() -> None:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Accept legal consent for a user")
    parser.add_argument("email", help="User email address")
    parser.add_argument(
        "--password", help="User password (will prompt if not provided)"
    )
    args = parser.parse_args()

    # Get password
    password = args.password or getpass("Password: ")

    # Run async function
    asyncio.run(accept_consent(args.email, password))


if __name__ == "__main__":
    main()
