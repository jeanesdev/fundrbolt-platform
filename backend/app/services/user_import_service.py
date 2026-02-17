"""Service for admin user imports."""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import json
import secrets
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.base import Base
from app.models.npo import NPO
from app.models.npo_member import MemberRole, MemberStatus, NPOMember
from app.models.user import User
from app.models.user_import import (
    UserImportBatch,
    UserImportIssue,
    UserImportIssueSeverity,
    UserImportStatus,
)
from app.schemas.user_import import (
    ErrorReportRequest,
    ErrorReportResponse,
    ImportErrorReportFormat,
    ImportResult,
    ImportRowResult,
    ImportRowStatus,
    IssueSeverity,
    PreflightIssue,
    PreflightResult,
)
from app.services.password_service import PasswordService

MAX_IMPORT_ROWS = 5000
REQUIRED_HEADERS = ["full_name", "email", "role"]
OPTIONAL_HEADERS = ["npo_identifier", "phone", "title", "password"]

ROLE_ALIASES = {
    "super_admin": "super_admin",
    "super admin": "super_admin",
    "npo_admin": "npo_admin",
    "npo admin": "npo_admin",
    "event_coordinator": "event_coordinator",
    "event coordinator": "event_coordinator",
    "staff": "staff",
    "donor": "donor",
}

ALLOWED_IMPORT_ROLES = {"npo_admin", "event_coordinator"}

MEMBER_ROLE_BY_USER_ROLE = {
    "npo_admin": MemberRole.ADMIN,
    "event_coordinator": MemberRole.STAFF,
}


@dataclass
class ParsedRow:
    row_number: int
    data: dict[str, Any]


@dataclass
class ValidatedRow:
    row_number: int
    data: dict[str, Any]
    email: str | None
    full_name: str | None
    role: str | None
    errors: list[PreflightIssue]
    warnings: list[PreflightIssue]


class UserImportError(Exception):
    """Base exception for user import errors."""


class UserImportService:
    """Bulk import service for users."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._email_adapter = TypeAdapter(EmailStr)

    async def preflight(
        self,
        npo_id: UUID,
        file_bytes: bytes,
        filename: str,
        initiated_by_user_id: UUID,
    ) -> PreflightResult:
        """Validate uploaded file and return preflight results."""
        file_type = self._detect_file_type(filename)
        parsed_rows = self._parse_file(file_bytes, file_type)

        if len(parsed_rows) > MAX_IMPORT_ROWS:
            raise UserImportError(
                f"File contains {len(parsed_rows)} rows. Maximum allowed is {MAX_IMPORT_ROWS}."
            )

        npo = await self._fetch_npo(npo_id)

        raw_emails = [self._normalize_email(row.data.get("email")) for row in parsed_rows]
        email_values: list[str] = [email for email in raw_emails if email is not None]
        existing_users = await self._fetch_existing_users(email_values)
        existing_members = await self._fetch_existing_members(npo_id, list(existing_users.values()))
        role_ids = await self._fetch_role_ids(ALLOWED_IMPORT_ROLES)

        validated_rows = self._validate_rows(
            parsed_rows=parsed_rows,
            npo_name=npo.name,
            existing_users=existing_users,
            existing_member_ids=existing_members,
            role_ids=role_ids,
        )

        issues, warnings, valid_rows, error_rows, warning_rows = self._summarize_validation(
            validated_rows
        )

        checksum = hashlib.sha256(file_bytes).hexdigest()

        batch = UserImportBatch(
            npo_id=npo_id,
            initiated_by_user_id=initiated_by_user_id,
            file_name=filename,
            file_checksum=checksum,
            file_type=file_type,
            status=UserImportStatus.PREFLIGHT,
            total_rows=len(parsed_rows),
            valid_rows=valid_rows,
            error_rows=error_rows,
            warning_rows=warning_rows,
            created_count=0,
            skipped_count=0,
            membership_added_count=0,
            failed_count=0,
        )
        self.db.add(batch)
        await self.db.flush()

        for issue in issues + warnings:
            self.db.add(
                UserImportIssue(
                    batch_id=batch.id,
                    row_number=issue.row_number,
                    severity=UserImportIssueSeverity(issue.severity.value),
                    field_name=issue.field_name,
                    message=issue.message,
                    raw_value=issue.raw_value,
                )
            )

        return PreflightResult(
            preflight_id=str(batch.id),
            detected_format=file_type,
            file_checksum=checksum,
            total_rows=len(parsed_rows),
            valid_rows=valid_rows,
            error_rows=error_rows,
            warning_rows=warning_rows,
            issues=issues,
            warnings=warnings,
            error_report_url=self._build_error_report_url(issues),
        )

    async def commit(
        self,
        npo_id: UUID,
        preflight_id: str,
        file_bytes: bytes,
        initiated_by_user_id: UUID,
    ) -> ImportResult:
        """Execute import after preflight."""
        try:
            preflight_uuid = UUID(preflight_id)
        except ValueError as exc:
            raise UserImportError("Invalid preflight_id") from exc

        batch = await self._fetch_preflight_batch(npo_id, preflight_uuid)

        if batch.status != UserImportStatus.PREFLIGHT:
            raise UserImportError("Preflight batch is not eligible for commit")

        checksum = hashlib.sha256(file_bytes).hexdigest()
        if batch.file_checksum != checksum:
            raise UserImportError("File has changed since preflight. Please re-run preflight.")

        if batch.error_rows > 0:
            raise UserImportError("Cannot import file with errors. Please fix errors and re-run.")

        parsed_rows = self._parse_file(file_bytes, batch.file_type)
        npo = await self._fetch_npo(npo_id)

        raw_emails = [self._normalize_email(row.data.get("email")) for row in parsed_rows]
        email_values: list[str] = [email for email in raw_emails if email is not None]
        existing_users = await self._fetch_existing_users(email_values)
        existing_member_ids = await self._fetch_existing_members(
            npo_id, list(existing_users.values())
        )
        role_ids = await self._fetch_role_ids(ALLOWED_IMPORT_ROLES)

        validated_rows = self._validate_rows(
            parsed_rows=parsed_rows,
            npo_name=npo.name,
            existing_users=existing_users,
            existing_member_ids=existing_member_ids,
            role_ids=role_ids,
        )

        warnings: list[PreflightIssue] = []
        results: list[ImportRowResult] = []

        created_rows = 0
        skipped_rows = 0
        membership_added_rows = 0
        failed_rows = 0
        reset_emails: list[tuple[int, str]] = []

        for row in validated_rows:
            warnings.extend(row.warnings)
            if row.errors:
                failed_rows += 1
                results.append(
                    ImportRowResult(
                        row_number=row.row_number,
                        email=row.email,
                        full_name=row.full_name,
                        status=ImportRowStatus.ERROR,
                        message="Row has validation errors",
                    )
                )
                continue

            if not row.email or not row.role or not row.full_name:
                failed_rows += 1
                results.append(
                    ImportRowResult(
                        row_number=row.row_number,
                        email=row.email,
                        full_name=row.full_name,
                        status=ImportRowStatus.ERROR,
                        message="Missing required fields",
                    )
                )
                continue

            existing_user = existing_users.get(row.email)

            if existing_user:
                if existing_user.id in existing_member_ids:
                    skipped_rows += 1
                    results.append(
                        ImportRowResult(
                            row_number=row.row_number,
                            email=row.email,
                            full_name=row.full_name,
                            status=ImportRowStatus.SKIPPED,
                            message="Skipped: user already in selected NPO",
                        )
                    )
                    continue

                member_role = MEMBER_ROLE_BY_USER_ROLE.get(row.role)
                if not member_role:
                    failed_rows += 1
                    results.append(
                        ImportRowResult(
                            row_number=row.row_number,
                            email=row.email,
                            full_name=row.full_name,
                            status=ImportRowStatus.ERROR,
                            message="Unsupported role for NPO membership",
                        )
                    )
                    continue

                self.db.add(
                    NPOMember(
                        npo_id=npo_id,
                        user_id=existing_user.id,
                        role=member_role,
                        status=MemberStatus.ACTIVE,
                        joined_at=datetime.utcnow(),
                    )
                )
                membership_added_rows += 1
                results.append(
                    ImportRowResult(
                        row_number=row.row_number,
                        email=row.email,
                        full_name=row.full_name,
                        status=ImportRowStatus.MEMBERSHIP_ADDED,
                        message="Added user to selected NPO",
                    )
                )
                continue

            first_name, last_name = self._split_full_name(row.full_name)
            if not first_name or not last_name:
                failed_rows += 1
                results.append(
                    ImportRowResult(
                        row_number=row.row_number,
                        email=row.email,
                        full_name=row.full_name,
                        status=ImportRowStatus.ERROR,
                        message="Full name must include first and last name",
                    )
                )
                continue

            password = str(row.data.get("password") or "").strip()
            if not password:
                password = self._generate_temp_password()

            user = User(
                email=row.email,
                first_name=first_name,
                last_name=last_name,
                phone=str(row.data.get("phone") or "").strip() or None,
                password_hash=hash_password(password),
                role_id=role_ids[row.role],
                npo_id=npo_id,
                email_verified=True,
                is_active=True,
            )
            self.db.add(user)
            await self.db.flush()

            member_role = MEMBER_ROLE_BY_USER_ROLE.get(row.role)
            if member_role:
                self.db.add(
                    NPOMember(
                        npo_id=npo_id,
                        user_id=user.id,
                        role=member_role,
                        status=MemberStatus.ACTIVE,
                        joined_at=datetime.utcnow(),
                    )
                )

            created_rows += 1
            reset_emails.append((row.row_number, user.email))
            results.append(
                ImportRowResult(
                    row_number=row.row_number,
                    email=row.email,
                    full_name=row.full_name,
                    status=ImportRowStatus.CREATED,
                    message="User created",
                )
            )

        batch.status = UserImportStatus.COMMITTED
        batch.total_rows = len(parsed_rows)
        batch.valid_rows = len(parsed_rows) - failed_rows
        batch.error_rows = failed_rows
        batch.warning_rows = len({issue.row_number for issue in warnings})
        batch.created_count = created_rows
        batch.skipped_count = skipped_rows
        batch.membership_added_count = membership_added_rows
        batch.failed_count = failed_rows
        self.db.add(batch)
        await self.db.commit()

        for row_number, email in reset_emails:
            try:
                await PasswordService.request_reset(email, self.db)
            except Exception:
                warnings.append(
                    PreflightIssue(
                        row_number=row_number,
                        field_name="email",
                        severity=IssueSeverity.WARNING,
                        message=f"Password reset email failed to send for {email}",
                        raw_value=email,
                    )
                )

        return ImportResult(
            batch_id=str(batch.id),
            created_rows=created_rows,
            skipped_rows=skipped_rows,
            membership_added_rows=membership_added_rows,
            failed_rows=failed_rows,
            rows=results,
            warnings=warnings,
        )

    def build_error_report(self, request: ErrorReportRequest) -> ErrorReportResponse:
        """Build downloadable error report content."""
        rows = [row for row in request.rows if row.status == ImportRowStatus.ERROR]

        if request.format == ImportErrorReportFormat.JSON:
            payload = [row.model_dump() for row in rows]
            return ErrorReportResponse(
                format=request.format,
                content_type="application/json",
                filename="user-import-errors.json",
                content=json.dumps(payload, indent=2),
            )

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["row_number", "email", "full_name", "status", "message"])
        for row in rows:
            writer.writerow(
                [
                    row.row_number,
                    row.email or "",
                    row.full_name or "",
                    row.status,
                    row.message,
                ]
            )

        return ErrorReportResponse(
            format=request.format,
            content_type="text/csv",
            filename="user-import-errors.csv",
            content=output.getvalue(),
        )

    def _detect_file_type(self, filename: str) -> str:
        filename_lower = filename.lower()
        if filename_lower.endswith(".json"):
            return "json"
        if filename_lower.endswith(".csv"):
            return "csv"
        raise UserImportError("Unsupported file type. Must be JSON or CSV.")

    def _parse_file(self, file_bytes: bytes, file_type: str) -> list[ParsedRow]:
        if file_type == "json":
            return self._parse_json(file_bytes)
        if file_type == "csv":
            return self._parse_csv(file_bytes)
        raise UserImportError(f"Unsupported file type: {file_type}")

    def _parse_json(self, file_bytes: bytes) -> list[ParsedRow]:
        try:
            content = file_bytes.decode("utf-8")
            data = json.loads(content)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise UserImportError(f"Invalid JSON file: {exc}") from exc

        if not isinstance(data, list):
            raise UserImportError("JSON must contain an array of user objects")

        if not data:
            raise UserImportError("JSON file contains no data")

        if len(data) > MAX_IMPORT_ROWS:
            raise UserImportError(
                f"File exceeds maximum of {MAX_IMPORT_ROWS} rows (found {len(data)})"
            )

        parsed_rows: list[ParsedRow] = []
        for index, obj in enumerate(data, start=1):
            if not isinstance(obj, dict):
                raise UserImportError("JSON entries must be objects")
            row_data = {self._normalize_header(k): self._normalize_cell(v) for k, v in obj.items()}
            parsed_rows.append(ParsedRow(row_number=index, data=row_data))

        if not parsed_rows:
            raise UserImportError("JSON file contains no valid data rows")

        return parsed_rows

    def _parse_csv(self, file_bytes: bytes) -> list[ParsedRow]:
        try:
            content = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise UserImportError("CSV must be UTF-8 encoded") from exc

        reader = csv.reader(io.StringIO(content))
        header_row = next(reader, None)
        if not header_row:
            raise UserImportError("CSV is empty")

        headers = [self._normalize_header(value) for value in header_row]
        self._validate_required_headers(headers)

        parsed_rows: list[ParsedRow] = []
        for index, values in enumerate(reader, start=2):
            if self._is_empty_row(values):
                continue
            if len(parsed_rows) >= MAX_IMPORT_ROWS:
                raise UserImportError(f"CSV exceeds maximum of {MAX_IMPORT_ROWS} rows")

            row_data = {
                headers[i]: self._normalize_cell(values[i]) if i < len(values) else None
                for i in range(len(headers))
            }
            parsed_rows.append(ParsedRow(row_number=index, data=row_data))

        if not parsed_rows:
            raise UserImportError("CSV contains no data rows")

        return parsed_rows

    def _validate_required_headers(self, headers: list[str]) -> None:
        missing = [header for header in REQUIRED_HEADERS if header not in headers]
        if missing:
            raise UserImportError(f"Missing required columns: {', '.join(missing)}")

    def _is_empty_row(self, values: tuple[Any, ...] | list[Any]) -> bool:
        return all(value is None or str(value).strip() == "" for value in values)

    def _normalize_header(self, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip().lower().replace(" ", "_").replace("-", "_")

    def _normalize_cell(self, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value

    def _normalize_email(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    def _normalize_role(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return ROLE_ALIASES.get(normalized)

    def _normalize_identifier(self, value: Any) -> str | None:
        if value is None:
            return None
        return str(value).strip().lower()

    def _split_full_name(self, full_name: str | None) -> tuple[str | None, str | None]:
        if not full_name:
            return None, None
        parts = [part for part in full_name.strip().split() if part]
        if len(parts) < 2:
            return None, None
        return parts[0], " ".join(parts[1:])

    def _validate_password(self, value: str) -> bool:
        if len(value) < 8:
            return False
        if not any(char.isalpha() for char in value):
            return False
        if not any(char.isdigit() for char in value):
            return False
        return True

    def _generate_temp_password(self) -> str:
        return f"Tmp{secrets.token_urlsafe(10)}1"

    async def _fetch_npo(self, npo_id: UUID) -> NPO:
        result = await self.db.execute(select(NPO).where(NPO.id == npo_id))
        npo = result.scalar_one_or_none()
        if not npo:
            raise UserImportError("NPO not found")
        return npo

    async def _fetch_existing_users(self, emails: list[str]) -> dict[str, User]:
        if not emails:
            return {}
        result = await self.db.execute(select(User).where(User.email.in_(emails)))
        users = result.scalars().all()
        return {user.email: user for user in users}

    async def _fetch_existing_members(self, npo_id: UUID, users: list[User]) -> set[UUID]:
        if not users:
            return set()
        user_ids = [user.id for user in users]
        result = await self.db.execute(
            select(NPOMember.user_id).where(
                NPOMember.npo_id == npo_id,
                NPOMember.user_id.in_(user_ids),
                NPOMember.status == MemberStatus.ACTIVE,
            )
        )
        return {row[0] for row in result.all()}

    async def _fetch_role_ids(self, roles: set[str]) -> dict[str, UUID]:
        roles_table = Base.metadata.tables["roles"]
        result = await self.db.execute(
            select(roles_table.c.name, roles_table.c.id).where(roles_table.c.name.in_(roles))
        )
        role_map = {row[0]: row[1] for row in result.all()}
        missing_roles = roles - set(role_map.keys())
        if missing_roles:
            raise UserImportError(f"Unsupported roles: {', '.join(sorted(missing_roles))}")
        return role_map

    async def _fetch_preflight_batch(self, npo_id: UUID, preflight_id: UUID) -> UserImportBatch:
        result = await self.db.execute(
            select(UserImportBatch).where(
                UserImportBatch.id == preflight_id,
                UserImportBatch.npo_id == npo_id,
            )
        )
        batch = result.scalar_one_or_none()
        if not batch:
            raise UserImportError("Preflight batch not found")
        return batch

    def _validate_rows(
        self,
        parsed_rows: list[ParsedRow],
        npo_name: str,
        existing_users: dict[str, User],
        existing_member_ids: set[UUID],
        role_ids: dict[str, UUID],
    ) -> list[ValidatedRow]:
        emails = [self._normalize_email(row.data.get("email")) for row in parsed_rows]
        email_counts = Counter(email for email in emails if email)

        validated: list[ValidatedRow] = []
        for row in parsed_rows:
            errors: list[PreflightIssue] = []
            warnings: list[PreflightIssue] = []

            full_name = str(row.data.get("full_name") or "").strip()
            email = self._normalize_email(row.data.get("email"))
            role_value = row.data.get("role")
            role = self._normalize_role(role_value)

            if not full_name:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="full_name",
                        severity=IssueSeverity.ERROR,
                        message="Full name is required",
                    )
                )
            elif self._split_full_name(full_name) == (None, None):
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="full_name",
                        severity=IssueSeverity.ERROR,
                        message="Full name must include first and last name",
                    )
                )

            if not email:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="email",
                        severity=IssueSeverity.ERROR,
                        message="Email is required",
                    )
                )
            else:
                try:
                    self._email_adapter.validate_python(email)
                except Exception:
                    errors.append(
                        PreflightIssue(
                            row_number=row.row_number,
                            field_name="email",
                            severity=IssueSeverity.ERROR,
                            message="Email format is invalid",
                            raw_value=email,
                        )
                    )

            if email and email_counts[email] > 1:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="email",
                        severity=IssueSeverity.ERROR,
                        message="Duplicate email detected in file",
                        raw_value=email,
                    )
                )

            if not role:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="role",
                        severity=IssueSeverity.ERROR,
                        message="Role is required",
                        raw_value=str(role_value) if role_value is not None else None,
                    )
                )
            elif role == "super_admin":
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="role",
                        severity=IssueSeverity.ERROR,
                        message="Super Admin role cannot be imported",
                        raw_value=role,
                    )
                )
            elif role not in ALLOWED_IMPORT_ROLES:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="role",
                        severity=IssueSeverity.ERROR,
                        message="Role must be NPO-scoped (NPO Admin or Event Coordinator)",
                        raw_value=role,
                    )
                )
            elif role not in role_ids:
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="role",
                        severity=IssueSeverity.ERROR,
                        message="Role is not configured in the system",
                        raw_value=role,
                    )
                )

            password_value = str(row.data.get("password") or "").strip()
            if password_value and not self._validate_password(password_value):
                errors.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="password",
                        severity=IssueSeverity.ERROR,
                        message="Password must be at least 8 characters and include letters and numbers",
                    )
                )
            elif not password_value:
                warnings.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="password",
                        severity=IssueSeverity.WARNING,
                        message="Temporary password will be generated and reset email sent",
                    )
                )

            npo_identifier = self._normalize_identifier(row.data.get("npo_identifier"))
            if npo_identifier and npo_identifier != npo_name.lower():
                warnings.append(
                    PreflightIssue(
                        row_number=row.row_number,
                        field_name="npo_identifier",
                        severity=IssueSeverity.WARNING,
                        message="NPO identifier does not match selected NPO",
                        raw_value=str(row.data.get("npo_identifier")),
                    )
                )

            if email and email in existing_users:
                existing_user = existing_users[email]
                if existing_user.id in existing_member_ids:
                    warnings.append(
                        PreflightIssue(
                            row_number=row.row_number,
                            field_name="email",
                            severity=IssueSeverity.WARNING,
                            message="User already belongs to selected NPO and will be skipped",
                            raw_value=email,
                        )
                    )
                else:
                    warnings.append(
                        PreflightIssue(
                            row_number=row.row_number,
                            field_name="email",
                            severity=IssueSeverity.WARNING,
                            message="Existing user will be added to selected NPO",
                            raw_value=email,
                        )
                    )

            validated.append(
                ValidatedRow(
                    row_number=row.row_number,
                    data=row.data,
                    email=email,
                    full_name=full_name or None,
                    role=role,
                    errors=errors,
                    warnings=warnings,
                )
            )

        return validated

    def _summarize_validation(
        self, validated_rows: list[ValidatedRow]
    ) -> tuple[list[PreflightIssue], list[PreflightIssue], int, int, int]:
        issues: list[PreflightIssue] = []
        warnings: list[PreflightIssue] = []
        error_rows = 0
        warning_rows = 0
        valid_rows = 0

        for row in validated_rows:
            issues.extend(row.errors)
            warnings.extend(row.warnings)
            if row.errors:
                error_rows += 1
            else:
                valid_rows += 1
            if row.warnings:
                warning_rows += 1

        return issues, warnings, valid_rows, error_rows, warning_rows

    def _build_error_report_url(self, issues: list[PreflightIssue]) -> str | None:
        error_issues = [issue for issue in issues if issue.severity == IssueSeverity.ERROR]
        if not error_issues:
            return None

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["row_number", "field_name", "severity", "message", "raw_value"])
        for issue in error_issues:
            writer.writerow(
                [
                    issue.row_number,
                    issue.field_name or "",
                    issue.severity,
                    issue.message,
                    issue.raw_value or "",
                ]
            )

        encoded = base64.b64encode(output.getvalue().encode("utf-8")).decode("utf-8")
        return f"data:text/csv;base64,{encoded}"
