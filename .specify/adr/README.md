# Architecture Decision Records (ADR)

This directory contains records of architectural decisions made during the development of the Fundrbolt Platform.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## Format

Each ADR follows this structure:
- **Title**: Short descriptive title
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: When the decision was made
- **Context**: What is the issue we're facing?
- **Decision**: What did we decide?
- **Consequences**: What are the trade-offs and implications?
- **Revisit Criteria**: When should we reconsider this decision?

## Index

- [ADR-001: Service-Based Permissions Over Database Permission Table](./001-service-based-permissions.md) - Accepted (2025-10-24)
- [ADR-002: Audit Logging Database Persistence](./002-audit-logging-database-persistence.md) - Accepted (2025-10-25)

## Creating a New ADR

1. Copy the template from an existing ADR
2. Use the next sequential number (e.g., 002)
3. Write a clear, descriptive filename
4. Update this index
5. Set status to "Proposed" initially
6. Update to "Accepted" once implemented
