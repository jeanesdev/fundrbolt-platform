# GitHub Copilot Cloud Agents

This directory contains specialized AI agent configurations for the Augeo Platform. These agents are domain experts that can be delegated specific tasks in their areas of expertise.

## Available Agents

### 🐍 Backend Python Specialist
**File**: `backend-python.md`

**Expertise**:
- FastAPI REST API development
- SQLAlchemy ORM and database models
- Pydantic validation schemas
- Authentication and authorization (OAuth2 + JWT)
- Azure service integration (Blob Storage, Key Vault)
- Backend testing with pytest
- Security best practices

**Delegate for**:
- Implementing new API endpoints
- Creating database models
- Writing business logic services
- Adding authentication features
- Integrating Azure services
- Writing backend tests
- Performance optimization

### ⚛️ Frontend TypeScript/React Specialist
**File**: `frontend-typescript.md`

**Expertise**:
- React 18 component development
- TypeScript type safety
- TanStack Router for routing
- Radix UI accessible components
- Tailwind CSS styling
- Zustand state management
- Form validation and error handling
- Frontend testing

**Delegate for**:
- Building React components
- Implementing page layouts
- Creating forms with validation
- API integration with Axios
- State management
- Responsive design
- UI/UX improvements
- Frontend tests

### ☁️ Infrastructure & DevOps Specialist
**File**: `infrastructure-devops.md`

**Expertise**:
- Azure Bicep infrastructure as code
- GitHub Actions CI/CD pipelines
- Azure App Service deployment
- PostgreSQL and Redis management
- Azure Blob Storage configuration
- Application Insights monitoring
- Security and compliance
- Disaster recovery

**Delegate for**:
- Creating Azure resources
- Updating CI/CD pipelines
- Configuring monitoring/alerts
- Managing secrets
- Implementing security policies
- Disaster recovery setup
- Cost optimization
- Deployment automation

### 🗄️ Database & Migration Specialist
**File**: `database-migrations.md`

**Expertise**:
- PostgreSQL database design
- SQLAlchemy model relationships
- Alembic migrations
- Query optimization
- Indexing strategies
- Data integrity constraints
- Redis caching
- Performance tuning

**Delegate for**:
- Creating database models
- Writing Alembic migrations
- Optimizing slow queries
- Adding database indexes
- Implementing soft deletes
- Data migrations
- Cache implementation
- Query performance analysis

## How to Use Cloud Agents

### In GitHub Copilot Chat

When working on a task that matches an agent's expertise, explicitly delegate to that agent:

```
@workspace /delegate I need to implement a new API endpoint for user profiles. Please delegate this to the Backend Python Specialist agent.
```

Or reference the agent directly:

```
@workspace Following the Backend Python Specialist guidelines, implement a new FastAPI endpoint for fetching user statistics.
```

### For Complex Tasks

Break down complex tasks and delegate different parts to specialized agents:

```markdown
Task: Add user profile feature with avatar upload

1. Backend API (Backend Python Specialist):
   - Create /api/v1/users/{id}/profile endpoint
   - Add avatar upload with Azure Blob Storage
   - Update User model with profile fields

2. Frontend UI (Frontend TypeScript/React Specialist):
   - Create ProfilePage component
   - Build ProfileForm with validation
   - Implement avatar upload with preview

3. Database (Database & Migration Specialist):
   - Add profile_bio, avatar_url columns to users table
   - Create Alembic migration
   - Add indexes for performance

4. Infrastructure (Infrastructure & DevOps Specialist):
   - Configure Azure Blob Storage container
   - Update App Service settings
   - Set up monitoring for uploads
```

### Best Practices

1. **Choose the Right Agent**: Match the task to the agent's expertise area
2. **Provide Context**: Give agents enough information about requirements
3. **Be Specific**: Clearly state what needs to be implemented
4. **Follow Conventions**: Agents follow existing code patterns
5. **Review Output**: Always review agent-generated code before committing

## Agent Capabilities

Each agent has deep knowledge of:
- ✅ Technology stack and frameworks
- ✅ Code patterns and best practices
- ✅ Testing approaches
- ✅ Security considerations
- ✅ Performance optimization
- ✅ Error handling
- ✅ Documentation standards
- ✅ Development commands

## Examples

### Example 1: New Backend Endpoint

**Task**: Add endpoint to fetch event statistics

**Delegation**:
```
@workspace Delegate to Backend Python Specialist:
Create a new API endpoint GET /api/v1/events/{event_id}/statistics that returns:
- Total auction items
- Total sold items
- Total revenue
- Average bid value

Follow existing API patterns and include proper authentication.
```

### Example 2: Frontend Component

**Task**: Build a dashboard widget

**Delegation**:
```
@workspace Delegate to Frontend TypeScript/React Specialist:
Create a DashboardStatsCard component that displays:
- Event count
- Donor count
- Total donations
- Loading and error states

Use Tailwind CSS and follow existing component patterns.
```

### Example 3: Database Migration

**Task**: Add email verification tracking

**Delegation**:
```
@workspace Delegate to Database & Migration Specialist:
Add the following fields to users table:
- email_verified (boolean, default false)
- verification_token (string, nullable)
- verification_sent_at (datetime, nullable)

Create the Alembic migration with proper indexes.
```

### Example 4: Infrastructure Update

**Task**: Set up new Azure service

**Delegation**:
```
@workspace Delegate to Infrastructure & DevOps Specialist:
Create a Bicep module for Azure Communication Services to send emails.
Include:
- Email service resource
- DNS configuration
- Environment-specific parameters (dev, staging, prod)
- Monitoring and alerts
```

## Agent Coordination

For features that span multiple domains, agents can work together:

```markdown
Feature: Auction Item Bidding

1. Database Agent:
   - Create bids table
   - Add foreign keys to auction_items and users
   - Create indexes for queries

2. Backend Agent:
   - Implement POST /api/v1/auction-items/{id}/bids
   - Add bid validation logic
   - Send notifications on new bids

3. Frontend Agent:
   - Create BidForm component
   - Real-time bid updates
   - Bid history display

4. Infrastructure Agent:
   - Set up Redis pub/sub for real-time updates
   - Configure WebSocket on App Service
   - Add monitoring for bid events
```

## Updating Agents

Agent configurations are markdown files that can be updated to:
- Add new patterns and examples
- Update technology versions
- Include project-specific conventions
- Add troubleshooting guides

To update an agent:
1. Edit the corresponding `.md` file
2. Add new sections or examples
3. Update version-specific information
4. Commit changes to the repository

## Support

If you encounter issues with agent delegation:
1. Check that you're using the correct agent for the task
2. Provide clear, specific requirements
3. Reference existing code patterns
4. Review the agent's capability list

## Learn More

- [GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Augeo Platform README](../../README.md)
- [Backend README](../../backend/README.md)
- [Frontend README](../../frontend/augeo-admin/README.md)
- [Infrastructure Guide](../../infrastructure/README.md)
