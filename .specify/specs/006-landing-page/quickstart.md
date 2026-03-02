# Quickstart Guide: Landing Page Feature

**Feature**: 006-landing-page
**Target Audience**: Developers implementing the landing page
**Prerequisites**: Features 001, 002, and 005 completed

## Overview

This guide provides step-by-step instructions for implementing the public landing page feature, including backend API, frontend pages, database schema, and testing.

## Architecture Summary

```
┌─────────────────┐
│  Public Users   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│   Frontend (landing-site SPA)   │
│  - Landing Page                  │
│  - About Page                    │
│  - Testimonials Page             │
│  - Contact Page                  │
└────────┬─────────────────────────┘
         │ HTTP/REST
         ▼
┌──────────────────────────────────┐
│   Backend (FastAPI)              │
│  /api/v1/public/contact          │
│  /api/v1/public/testimonials     │
│  /api/v1/admin/testimonials      │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│   PostgreSQL                     │
│  - contact_submissions           │
│  - testimonials                  │
└──────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Backend Setup (3-4 hours)

#### 1.1 Create Database Models

```bash
# Create model files
touch backend/app/models/contact_submission.py
touch backend/app/models/testimonial.py
```

Copy the SQLAlchemy models from [data-model.md](./data-model.md) into these files.

#### 1.2 Create Pydantic Schemas

```bash
# Create schema files
touch backend/app/schemas/contact.py
touch backend/app/schemas/testimonial.py
```

Copy the Pydantic schemas from [data-model.md](./data-model.md) into these files.

#### 1.3 Create Database Migration

```bash
cd backend
poetry run alembic revision -m "add_contact_testimonial_tables"
```

Edit the generated migration file with the upgrade/downgrade from [data-model.md](./data-model.md).

Run migration:

```bash
poetry run alembic upgrade head
```

Verify tables created:

```bash
poetry run python -c "
from app.core.database import engine
from sqlalchemy import inspect
inspector = inspect(engine)
print('Tables:', inspector.get_table_names())
print('contact_submissions columns:', [c['name'] for c in inspector.get_columns('contact_submissions')])
print('testimonials columns:', [c['name'] for c in inspector.get_columns('testimonials')])
"
```

#### 1.4 Create Service Layer

```bash
# Create service files
touch backend/app/services/contact_service.py
touch backend/app/services/testimonial_service.py
```

**ContactService** (backend/app/services/contact_service.py):

```python
from sqlalchemy.orm import Session
from app.models.contact_submission import ContactSubmission, SubmissionStatus
from app.schemas.contact import ContactSubmissionCreate
from app.services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)

class ContactService:
    def __init__(self, db: Session):
        self.db = db
        self.email_service = EmailService()

    async def create_submission(
        self,
        data: ContactSubmissionCreate,
        ip_address: str
    ) -> ContactSubmission:
        """Create contact submission record"""
        submission = ContactSubmission(
            sender_name=data.sender_name,
            sender_email=data.sender_email,
            subject=data.subject,
            message=data.message,
            ip_address=ip_address,
            status=SubmissionStatus.PENDING
        )
        self.db.add(submission)
        self.db.commit()
        self.db.refresh(submission)

        logger.info(
            f"Contact submission created: {submission.id} from {ip_address}",
            extra={"submission_id": str(submission.id), "ip": ip_address}
        )

        return submission

    async def send_email_notification(self, submission: ContactSubmission):
        """Send email to platform team"""
        try:
            await self.email_service.send_contact_notification(
                to="ops@fundrbolt.com",
                sender_name=submission.sender_name,
                sender_email=submission.sender_email,
                subject=submission.subject,
                message=submission.message
            )

            submission.status = SubmissionStatus.PROCESSED
            self.db.commit()

            logger.info(f"Contact email sent: {submission.id}")

        except Exception as e:
            submission.status = SubmissionStatus.FAILED
            self.db.commit()

            logger.error(
                f"Failed to send contact email: {submission.id}",
                exc_info=e,
                extra={"submission_id": str(submission.id)}
            )
            # Don't raise - user already got confirmation
```

**TestimonialService** (backend/app/services/testimonial_service.py):

```python
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.testimonial import Testimonial, AuthorRole
from app.schemas.testimonial import TestimonialCreate, TestimonialUpdate
from typing import List, Optional
from uuid import UUID

class TestimonialService:
    def __init__(self, db: Session):
        self.db = db

    def get_published_testimonials(
        self,
        limit: int = 10,
        offset: int = 0,
        role: Optional[AuthorRole] = None
    ) -> List[Testimonial]:
        """Get published testimonials for public display"""
        query = self.db.query(Testimonial).filter(
            and_(
                Testimonial.is_published == True,
                Testimonial.deleted_at.is_(None)
            )
        )

        if role:
            query = query.filter(Testimonial.author_role == role)

        return query.order_by(
            Testimonial.display_order.asc(),
            Testimonial.created_at.desc()
        ).limit(limit).offset(offset).all()

    def create_testimonial(
        self,
        data: TestimonialCreate,
        created_by: UUID
    ) -> Testimonial:
        """Create new testimonial (admin only)"""
        testimonial = Testimonial(
            created_by=created_by,
            **data.dict()
        )
        self.db.add(testimonial)
        self.db.commit()
        self.db.refresh(testimonial)
        return testimonial

    def update_testimonial(
        self,
        testimonial_id: UUID,
        data: TestimonialUpdate
    ) -> Optional[Testimonial]:
        """Update existing testimonial"""
        testimonial = self.db.query(Testimonial).filter(
            Testimonial.id == testimonial_id
        ).first()

        if not testimonial:
            return None

        for field, value in data.dict(exclude_unset=True).items():
            setattr(testimonial, field, value)

        self.db.commit()
        self.db.refresh(testimonial)
        return testimonial

    def delete_testimonial(self, testimonial_id: UUID) -> bool:
        """Soft delete testimonial"""
        testimonial = self.db.query(Testimonial).filter(
            Testimonial.id == testimonial_id
        ).first()

        if not testimonial:
            return False

        from datetime import datetime
        testimonial.deleted_at = datetime.utcnow()
        self.db.commit()
        return True
```

#### 1.5 Create API Endpoints

```bash
# Create API endpoint files
mkdir -p backend/app/api/v1/public
touch backend/app/api/v1/public/__init__.py
touch backend/app/api/v1/public/contact.py
touch backend/app/api/v1/public/testimonials.py
```

**Contact Endpoints** (backend/app/api/v1/public/contact.py):

```python
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.contact import ContactSubmissionCreate, ContactSubmissionResponse
from app.services.contact_service import ContactService
from app.middleware.rate_limit import rate_limit

router = APIRouter(prefix="/public/contact", tags=["public"])

@router.post("/submit", response_model=ContactSubmissionResponse, status_code=201)
@rate_limit(max_requests=5, window_seconds=3600)
async def submit_contact_form(
    data: ContactSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Submit contact form

    Rate limited to 5 submissions per hour per IP address.
    Email notification sent to platform team asynchronously.
    """
    service = ContactService(db)

    # Create submission record
    submission = await service.create_submission(
        data,
        request.client.host
    )

    # Send email (async, non-blocking)
    await service.send_email_notification(submission)

    return submission
```

**Testimonial Endpoints** (backend/app/api/v1/public/testimonials.py):

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.core.database import get_db
from app.schemas.testimonial import (
    TestimonialResponse,
    TestimonialCreate,
    TestimonialUpdate,
    TestimonialDetail
)
from app.services.testimonial_service import TestimonialService
from app.models.testimonial import AuthorRole
from app.middleware.auth import get_current_user, require_role
from app.models.user import User

router = APIRouter(tags=["testimonials"])

# Public endpoints
@router.get("/public/testimonials", response_model=List[TestimonialResponse])
async def list_testimonials(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    role: Optional[AuthorRole] = None,
    db: Session = Depends(get_db)
):
    """Get published testimonials (public access)"""
    service = TestimonialService(db)
    return service.get_published_testimonials(limit, offset, role)

# Admin endpoints
@router.post("/admin/testimonials", response_model=TestimonialResponse, status_code=201)
@require_role("superadmin")
async def create_testimonial(
    data: TestimonialCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create testimonial (admin only)"""
    service = TestimonialService(db)
    return service.create_testimonial(data, current_user.id)

@router.patch("/admin/testimonials/{testimonial_id}", response_model=TestimonialResponse)
@require_role("superadmin")
async def update_testimonial(
    testimonial_id: UUID,
    data: TestimonialUpdate,
    db: Session = Depends(get_db)
):
    """Update testimonial (admin only)"""
    service = TestimonialService(db)
    testimonial = service.update_testimonial(testimonial_id, data)

    if not testimonial:
        raise HTTPException(status_code=404, detail="Testimonial not found")

    return testimonial

@router.delete("/admin/testimonials/{testimonial_id}", status_code=204)
@require_role("superadmin")
async def delete_testimonial(
    testimonial_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete testimonial (admin only)"""
    service = TestimonialService(db)
    success = service.delete_testimonial(testimonial_id)

    if not success:
        raise HTTPException(status_code=404, detail="Testimonial not found")
```

#### 1.6 Register Routes in Main App

Edit `backend/app/main.py`:

```python
from app.api.v1.public import contact, testimonials

# Add to existing router setup
app.include_router(contact.router, prefix="/api/v1")
app.include_router(testimonials.router, prefix="/api/v1")
```

#### 1.7 Test Backend

```bash
# Start backend
cd backend
poetry run uvicorn app.main:app --reload

# In another terminal, test endpoints
curl -X POST http://localhost:8000/api/v1/public/contact/submit \
  -H "Content-Type: application/json" \
  -d '{
    "sender_name": "Test User",
    "sender_email": "test@example.com",
    "subject": "Test Subject",
    "message": "Test message"
  }'

curl http://localhost:8000/api/v1/public/testimonials
```

### Phase 2: Frontend Setup (4-5 hours)

#### 2.1 Create Landing Site App

```bash
cd frontend
mkdir -p landing-site/src/{pages,components,services,hooks,routes}
cd landing-site

# Initialize package.json
pnpm init

# Install dependencies
pnpm add react react-dom react-router-dom axios zod react-hook-form @hookform/resolvers
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
```

#### 2.2 Create API Service

**src/services/api.ts**:

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ContactSubmission {
  sender_name: string;
  sender_email: string;
  subject: string;
  message: string;
}

export interface Testimonial {
  id: string;
  quote_text: string;
  author_name: string;
  author_role: 'donor' | 'auctioneer' | 'npo_admin';
  organization_name: string | null;
  photo_url: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
}

export const contactApi = {
  submit: async (data: ContactSubmission) => {
    const response = await api.post('/public/contact/submit', data);
    return response.data;
  },
};

export const testimonialApi = {
  list: async (params?: { limit?: number; offset?: number; role?: string }) => {
    const response = await api.get<Testimonial[]>('/public/testimonials', { params });
    return response.data;
  },
};
```

#### 2.3 Create Landing Page

**src/pages/LandingPage.tsx**:

```typescript
import React from 'react';
import { Link } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  return (
    <div className="landing-page">
      <header className="hero">
        <h1>Fundrbolt Fundraising Platform</h1>
        <p>World-class fundraising software that maximizes nonprofit revenue</p>
      </header>

      <section className="cta-section">
        <h2>Get Started</h2>
        <div className="cta-buttons">
          <Link to="/register/donor" className="cta-button primary">
            Register as Donor
          </Link>
          <Link to="/register/auctioneer" className="cta-button primary">
            Register as Auctioneer
          </Link>
          <Link to="/register/npo" className="cta-button primary">
            Register Your NPO
          </Link>
          <Link to="/login" className="cta-button secondary">
            Login
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Why Fundrbolt?</h2>
        <div className="feature-grid">
          <div className="feature">
            <h3>Mobile Bidding</h3>
            <p>Digital bid paddles work on any device</p>
          </div>
          <div className="feature">
            <h3>Real-Time Updates</h3>
            <p>Instant leaderboards and notifications</p>
          </div>
          <div className="feature">
            <h3>Easy Setup</h3>
            <p>Get your event running in days, not weeks</p>
          </div>
        </div>
      </section>
    </div>
  );
};
```

#### 2.4 Create Contact Page

**src/pages/ContactPage.tsx**:

```typescript
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { contactApi } from '../services/api';

const contactSchema = z.object({
  sender_name: z.string().min(1).max(100),
  sender_email: z.string().email().max(255),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

type ContactFormData = z.infer<typeof contactSchema>;

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      setError(null);
      await contactApi.submit(data);
      setSubmitted(true);
      reset();
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Rate limit exceeded. Please try again later.');
      } else {
        setError('Failed to submit form. Please try again.');
      }
    }
  };

  if (submitted) {
    return (
      <div className="contact-page">
        <h1>Thank You!</h1>
        <p>Your message has been sent. We'll get back to you soon.</p>
        <button onClick={() => setSubmitted(false)}>Send Another Message</button>
      </div>
    );
  }

  return (
    <div className="contact-page">
      <h1>Contact Us</h1>
      <p>Have questions? We're here to help!</p>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="contact-form">
        <div className="form-field">
          <label htmlFor="sender_name">Name</label>
          <input
            id="sender_name"
            type="text"
            {...register('sender_name')}
            aria-invalid={errors.sender_name ? 'true' : 'false'}
          />
          {errors.sender_name && (
            <span className="error">{errors.sender_name.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="sender_email">Email</label>
          <input
            id="sender_email"
            type="email"
            {...register('sender_email')}
            aria-invalid={errors.sender_email ? 'true' : 'false'}
          />
          {errors.sender_email && (
            <span className="error">{errors.sender_email.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            {...register('subject')}
            aria-invalid={errors.subject ? 'true' : 'false'}
          />
          {errors.subject && (
            <span className="error">{errors.subject.message}</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            rows={6}
            {...register('message')}
            aria-invalid={errors.message ? 'true' : 'false'}
          />
          {errors.message && (
            <span className="error">{errors.message.message}</span>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
};
```

#### 2.5 Create Routes

**src/routes/index.tsx**:

```typescript
import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout';

const LandingPage = lazy(() => import('../pages/LandingPage'));
const AboutPage = lazy(() => import('../pages/AboutPage'));
const TestimonialsPage = lazy(() => import('../pages/TestimonialsPage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/testimonials" element={<TestimonialsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};
```

#### 2.6 Start Frontend

```bash
cd frontend/landing-site
pnpm dev
```

Visit http://localhost:3001

### Phase 3: Testing (3-4 hours)

#### 3.1 Backend Tests

**Contract Tests** (backend/tests/contract/test_contact_api.py):

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_submit_contact_form_success():
    """Test successful contact form submission"""
    response = client.post("/api/v1/public/contact/submit", json={
        "sender_name": "John Doe",
        "sender_email": "john@example.com",
        "subject": "Test Subject",
        "message": "Test message"
    })

    assert response.status_code == 201
    data = response.json()
    assert data["sender_name"] == "John Doe"
    assert data["status"] == "pending"
    assert "id" in data

def test_submit_contact_form_invalid_email():
    """Test contact form with invalid email"""
    response = client.post("/api/v1/public/contact/submit", json={
        "sender_name": "John Doe",
        "sender_email": "invalid-email",
        "subject": "Test",
        "message": "Test"
    })

    assert response.status_code == 422
```

#### 3.2 Frontend Tests

**Component Tests** (frontend/landing-site/src/components/__tests__/ContactForm.test.tsx):

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactPage } from '../pages/ContactPage';
import { contactApi } from '../services/api';

jest.mock('../services/api');

describe('ContactPage', () => {
  it('submits form successfully', async () => {
    const user = userEvent.setup();
    const mockSubmit = jest.spyOn(contactApi, 'submit').mockResolvedValue({});

    render(<ContactPage />);

    await user.type(screen.getByLabelText(/name/i), 'John Doe');
    await user.type(screen.getByLabelText(/email/i), 'john@example.com');
    await user.type(screen.getByLabelText(/subject/i), 'Test');
    await user.type(screen.getByLabelText(/message/i), 'Test message');

    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        sender_name: 'John Doe',
        sender_email: 'john@example.com',
        subject: 'Test',
        message: 'Test message',
      });
    });

    expect(screen.getByText(/thank you/i)).toBeInTheDocument();
  });
});
```

## Common Issues & Solutions

### Issue: Rate Limiting Not Working

**Solution**: Ensure Redis is running and rate_limit middleware is properly configured.

### Issue: Email Not Sending

**Solution**: Check SendGrid/ACS configuration in environment variables. Verify email service credentials.

### Issue: Frontend Can't Connect to Backend

**Solution**: Check Vite proxy configuration. Ensure backend is running on port 8000.

### Issue: Database Migration Fails

**Solution**: Check for existing tables. Review migration file. Ensure database connection.

## Next Steps

1. **Seed Data**: Run `poetry run python backend/seed_testimonials.py`
2. **Run Tests**: `make test-backend` and `make test-frontend`
3. **Deploy**: Follow deployment guide in `docs/operations/deployment.md`
4. **Monitor**: Check Application Insights for contact form submissions

## Resources

- [Feature Specification](./spec.md)
- [Data Model](./data-model.md)
- [API Contracts](./contracts/openapi.yaml)
- [Research Decisions](./research.md)
- [Constitution](.specify/memory/constitution.md)
