"""
Seed legal documents (Terms of Service and Privacy Policy) for development.

Usage:
    poetry run python seed_legal_documents.py
"""

import asyncio
from datetime import datetime

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.legal_document import (
    LegalDocument,
    LegalDocumentStatus,
    LegalDocumentType,
)


async def seed_legal_documents() -> None:
    """Seed initial legal documents."""
    print("🌱 Seeding legal documents...\n")

    async with AsyncSessionLocal() as session:
        # Check if documents already exist
        result = await session.execute(
            select(LegalDocument).where(LegalDocument.status == LegalDocumentStatus.PUBLISHED)
        )
        existing_docs = result.scalars().all()

        if existing_docs:
            print("⚠️  Published legal documents already exist:")
            for doc in existing_docs:
                print(f"   - {doc.document_type.value} v{doc.version}")
            print("\nℹ️  Skipping seed to avoid duplicates.")
            return

        # Terms of Service
        terms_content = """# Terms of Service

**Last Updated:** {date}

## 1. Acceptance of Terms

By accessing and using the Fundrbolt Platform ("Platform"), you accept and agree to be bound by the terms and provisions of this agreement.

## 2. Description of Service

Fundrbolt Platform is a nonprofit management and donor engagement system that provides:

- Event management and volunteer coordination
- Donation tracking and receipt generation
- Time banking and recognition systems
- Community engagement tools

## 3. User Accounts

### 3.1 Registration
- You must provide accurate, current, and complete information during registration
- You are responsible for maintaining the confidentiality of your account credentials
- You agree to notify us immediately of any unauthorized access to your account

### 3.2 Account Types
- **Super Admin**: Full system access and configuration
- **NPO Admin**: Organization-level administrative access
- **NPO Staff**: Event and volunteer management
- **Check-in Staff**: Event attendance tracking
- **Donor**: Donation and volunteer participation

## 4. User Conduct

You agree NOT to:
- Violate any laws or regulations
- Impersonate others or provide false information
- Upload malicious code or attempt to gain unauthorized access
- Harass, abuse, or harm other users
- Use the platform for commercial purposes without authorization

## 5. Data Privacy

- We collect and process your personal data as described in our Privacy Policy
- You retain ownership of your contributed content
- We may use aggregated, anonymized data for analytics and improvement

## 6. Intellectual Property

- The Platform and its original content are owned by Fundrbolt and protected by copyright
- User-generated content remains the property of the respective users
- By posting content, you grant us a license to use, display, and distribute it

## 7. Termination

We reserve the right to:
- Suspend or terminate accounts that violate these terms
- Modify or discontinue the Platform with reasonable notice
- Refuse service to anyone for any reason

## 8. Limitation of Liability

- The Platform is provided "as is" without warranties
- We are not liable for indirect, incidental, or consequential damages
- Our total liability is limited to the amount paid to us in the last 12 months

## 9. Changes to Terms

- We may modify these terms at any time
- Continued use after changes constitutes acceptance
- Material changes will be communicated via email or platform notifications

## 10. Contact Information

Questions about these Terms of Service?
- Email: legal@fundrbolt.com
- Address: 309 Woodhall Lane, Piedmont, SC 29673, USA

## 11. Governing Law

These terms are governed by the laws of South Carolina, without regard to conflict of law provisions.

---

By using the Fundrbolt Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
""".format(date=datetime.now().strftime("%B %d, %Y"))

        # Privacy Policy
        privacy_content = """# Privacy Policy

**Last Updated:** {date}

## 1. Introduction

Fundrbolt Platform ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

## 2. Information We Collect

### 2.1 Personal Information
We collect information that you provide directly:
- **Account Information**: Name, email address, phone number
- **Profile Information**: Organization affiliation, role, preferences
- **Transaction Information**: Donation history, volunteer hours, event participation

### 2.2 Automatically Collected Information
- **Usage Data**: Pages visited, features used, time spent
- **Device Information**: IP address, browser type, operating system
- **Location Data**: General geographic location (city/state level)

### 2.3 Cookies and Tracking Technologies
We use cookies and similar technologies to:
- Maintain your session and preferences
- Analyze platform usage and performance
- Provide personalized experiences

You can manage cookie preferences through our Cookie Consent banner.

## 3. How We Use Your Information

We use collected information to:
- Provide and maintain the Platform
- Process donations and issue tax receipts
- Send notifications about events and activities
- Improve our services and develop new features
- Comply with legal obligations
- Prevent fraud and ensure security

## 4. Legal Bases for Processing (GDPR)

We process your personal data based on:
- **Consent**: You have given explicit consent (e.g., email notifications)
- **Contract**: Processing is necessary to fulfill our service agreement
- **Legal Obligation**: We must comply with laws (e.g., tax reporting)
- **Legitimate Interest**: Processing benefits both parties (e.g., fraud prevention)

## 5. Data Sharing and Disclosure

We may share your information with:
- **Nonprofit Organizations**: When you engage with their events or donate
- **Service Providers**: Third-party vendors who assist our operations
- **Legal Authorities**: When required by law or to protect rights
- **Business Transfers**: In case of merger, acquisition, or asset sale

We do NOT sell your personal information to third parties.

## 6. Your Rights (GDPR Compliance)

You have the right to:
- **Access**: Request a copy of your personal data
- **Rectification**: Correct inaccurate or incomplete data
- **Erasure**: Request deletion of your data ("right to be forgotten")
- **Portability**: Receive your data in a structured, machine-readable format
- **Object**: Opt-out of certain data processing activities
- **Restrict**: Limit how we process your data
- **Withdraw Consent**: Revoke consent at any time

To exercise these rights, contact us at privacy@fundrbolt.com or use the in-platform data management tools.

## 7. Data Retention

We retain your personal data for:
- **Active Accounts**: Duration of your account plus 7 years for audit purposes
- **Deleted Accounts**: 30-day grace period, then anonymization (some data retained for legal compliance)
- **Financial Records**: 7 years as required by law

## 8. Data Security

We implement industry-standard security measures:
- Encryption in transit (TLS/SSL) and at rest
- Access controls and authentication
- Regular security audits and monitoring
- Incident response procedures

However, no method is 100% secure. Use strong passwords and report suspicious activity.

## 9. International Data Transfers

Your data may be transferred to and processed in countries other than your own. We ensure adequate safeguards through:
- Standard Contractual Clauses (EU)
- Adequacy decisions by relevant authorities
- Other legally approved mechanisms

## 10. Children's Privacy

The Platform is not intended for children under 13 (or 16 in the EU). We do not knowingly collect data from children. If we discover such data, we will delete it promptly.

## 11. Changes to This Policy

We may update this Privacy Policy periodically. Material changes will be communicated via:
- Email notification
- In-platform banner
- Updated "Last Updated" date

Continued use after changes constitutes acceptance.

## 12. Contact Us

Questions or concerns about privacy?
- **Email**: privacy@fundrbolt.com
- **Data Protection Officer**: dpo@fundrbolt.com
- **Address**: 309 Woodhall Lane, Piedmont, SC 29673, USA

## 13. Regulatory Information

For EU users:
- **Data Controller**: Fundrbolt Platform

---

By using the Fundrbolt Platform, you acknowledge that you have read and understood this Privacy Policy.
""".format(date=datetime.now().strftime("%B %d, %Y"))

        # Create Terms of Service
        tos = LegalDocument(
            document_type=LegalDocumentType.TERMS_OF_SERVICE,
            version="1.0",
            content=terms_content,
            status=LegalDocumentStatus.PUBLISHED,
            published_at=datetime.now(),
        )
        session.add(tos)
        print("✅ Created Terms of Service v1.0")

        # Create Privacy Policy
        privacy = LegalDocument(
            document_type=LegalDocumentType.PRIVACY_POLICY,
            version="1.0",
            content=privacy_content,
            status=LegalDocumentStatus.PUBLISHED,
            published_at=datetime.now(),
        )
        session.add(privacy)
        print("✅ Created Privacy Policy v1.0")

        await session.commit()

        print("\n✨ Legal documents seeded successfully!")
        print("\n" + "=" * 60)
        print("PUBLISHED DOCUMENTS")
        print("=" * 60)
        print("Terms of Service:  v1.0 (Published)")
        print("Privacy Policy:    v1.0 (Published)")
        print("=" * 60)
        print("\nℹ️  These documents are now available at:")
        print("   - http://localhost:5173/terms-of-service")
        print("   - http://localhost:5173/privacy-policy")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_legal_documents())
