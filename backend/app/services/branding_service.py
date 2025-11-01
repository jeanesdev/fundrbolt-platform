"""Branding Service for NPO visual identity management.

Handles branding configuration including colors, logos, and social media links.
Includes validation for color formats, contrast checking, and social media URL validation.
"""

import re
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models.npo import NPO
from app.models.npo_branding import NPOBranding
from app.schemas.npo_branding import BrandingCreateRequest, BrandingUpdateRequest

logger = get_logger(__name__)

# Social media URL patterns
SOCIAL_MEDIA_PATTERNS = {
    "facebook": r"^https?://(www\.)?(facebook|fb)\.com/[\w\-\.]+/?.*$",
    "twitter": r"^https?://(www\.)?(twitter|x)\.com/[\w]+/?.*$",
    "instagram": r"^https?://(www\.)?instagram\.com/[\w\.]+/?.*$",
    "linkedin": r"^https?://(www\.)?linkedin\.com/(company|in)/[\w\-]+/?.*$",
    "youtube": r"^https?://(www\.)?youtube\.com/(c|@|channel|user)/[\w\-]+/?.*$",
    "website": r"^https?://[\w\-\.]+\.[a-z]{2,}(/.*)?$",
}


class BrandingService:
    """Service for managing NPO branding and visual identity."""

    @staticmethod
    def validate_hex_color(color: str | None) -> bool:
        """Validate hex color format.

        Args:
            color: Hex color string (e.g., #FF5733)

        Returns:
            True if valid, False otherwise
        """
        if color is None:
            return False

        if not isinstance(color, str):
            return False

        if not color.startswith("#"):
            return False

        if len(color) != 7:
            return False

        try:
            int(color[1:], 16)
            return True
        except ValueError:
            return False

    @staticmethod
    def normalize_hex_color(color: str) -> str:
        """Normalize hex color to uppercase.

        Args:
            color: Hex color string

        Returns:
            Normalized uppercase hex color
        """
        return color.upper()

    @staticmethod
    def calculate_contrast_ratio(color1: str, color2: str) -> float:
        """Calculate contrast ratio between two colors (WCAG formula).

        Args:
            color1: First hex color
            color2: Second hex color

        Returns:
            Contrast ratio (1.0 to 21.0)
        """

        def get_luminance(hex_color: str) -> float:
            """Calculate relative luminance of a color."""
            # Remove # and convert to RGB
            hex_color = hex_color.lstrip("#")
            r_int, g_int, b_int = (
                int(hex_color[0:2], 16),
                int(hex_color[2:4], 16),
                int(hex_color[4:6], 16),
            )

            # Convert to 0-1 range
            r, g, b = r_int / 255.0, g_int / 255.0, b_int / 255.0

            # Apply gamma correction
            def linearize(c: float) -> float:
                return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

            r, g, b = linearize(r), linearize(g), linearize(b)

            # Calculate luminance
            return 0.2126 * r + 0.7152 * g + 0.0722 * b

        lum1 = get_luminance(color1)
        lum2 = get_luminance(color2)

        # Ensure lighter color is numerator
        lighter = max(lum1, lum2)
        darker = min(lum1, lum2)

        return (lighter + 0.05) / (darker + 0.05)

    @staticmethod
    def check_contrast_wcag_aa(color1: str, color2: str) -> bool:
        """Check if colors meet WCAG AA standard (4.5:1).

        Args:
            color1: First hex color
            color2: Second hex color

        Returns:
            True if meets WCAG AA, False otherwise
        """
        ratio = BrandingService.calculate_contrast_ratio(color1, color2)
        return ratio >= 4.5

    @staticmethod
    def check_color_pair_contrast(primary: str | None, secondary: str | None) -> str | None:
        """Check contrast between primary and secondary colors.

        Args:
            primary: Primary color
            secondary: Secondary color

        Returns:
            Warning message if contrast is low, None if acceptable
        """
        if not primary or not secondary:
            return None

        ratio = BrandingService.calculate_contrast_ratio(primary, secondary)

        if ratio < 3.0:  # Very low contrast
            return (
                f"Low contrast between colors (ratio: {ratio:.2f}:1). "
                "Consider using more distinct colors for better visual separation."
            )

        return None

    @staticmethod
    def validate_text_contrast(text_color: str, background_color: str) -> dict[str, Any]:
        """Validate text color contrast against background.

        Args:
            text_color: Text hex color
            background_color: Background hex color

        Returns:
            Dict with valid (bool) and message (str)
        """
        ratio = BrandingService.calculate_contrast_ratio(text_color, background_color)

        if ratio >= 4.5:  # WCAG AA
            return {"valid": True, "ratio": ratio, "message": "Good contrast for readability"}

        return {
            "valid": False,
            "ratio": ratio,
            "message": f"Insufficient contrast ({ratio:.2f}:1). WCAG AA requires 4.5:1 minimum.",
        }

    @staticmethod
    def suggest_color_alternatives(base_color: str, background: str, count: int = 3) -> list[str]:
        """Suggest alternative colors with better contrast.

        Args:
            base_color: Original color
            background: Background color to test against
            count: Number of suggestions to return

        Returns:
            List of hex colors with better contrast
        """
        suggestions: list[str] = []

        # Simple strategy: darken or lighten based on background
        bg_lum = int(background.lstrip("#"), 16)
        is_light_bg = bg_lum > 0x7FFFFF

        base_rgb = int(base_color.lstrip("#"), 16)
        r = (base_rgb >> 16) & 0xFF
        g = (base_rgb >> 8) & 0xFF
        b = base_rgb & 0xFF

        # Adjust brightness
        for factor in [0.5, 0.3, 0.7] if is_light_bg else [1.5, 1.8, 1.3]:
            new_r = min(255, max(0, int(r * factor)))
            new_g = min(255, max(0, int(g * factor)))
            new_b = min(255, max(0, int(b * factor)))

            new_color = f"#{new_r:02X}{new_g:02X}{new_b:02X}"

            # Verify it meets contrast requirement
            if BrandingService.check_contrast_wcag_aa(new_color, background):
                suggestions.append(new_color)

            if len(suggestions) >= count:
                break

        return suggestions[:count]

    @staticmethod
    def simulate_color_blindness(color: str, color_blindness_type: str = "deuteranopia") -> str:
        """Simulate how color appears with color blindness.

        Args:
            color: Hex color
            color_blindness_type: Type (deuteranopia, protanopia, tritanopia)

        Returns:
            Simulated hex color
        """
        # Remove # and convert to RGB
        hex_color = color.lstrip("#")
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

        # Apply color blindness transformation matrices
        # Simplified simulation - real implementation would use precise matrices
        if color_blindness_type == "deuteranopia":  # Red-green (green deficiency)
            r_new = int(0.625 * r + 0.375 * g)
            g_new = int(0.7 * r + 0.3 * g)
            b_new = b
        elif color_blindness_type == "protanopia":  # Red-green (red deficiency)
            r_new = int(0.567 * r + 0.433 * g)
            g_new = int(0.558 * r + 0.442 * g)
            b_new = b
        elif color_blindness_type == "tritanopia":  # Blue-yellow
            r_new = r
            g_new = int(0.95 * g + 0.05 * b)
            b_new = int(0.433 * g + 0.567 * b)
        else:
            return color  # Unknown type, return original

        return f"#{r_new:02X}{g_new:02X}{b_new:02X}"

    @staticmethod
    def validate_social_media_url(platform: str, url: str) -> dict[str, Any]:
        """Validate social media URL for specific platform.

        Args:
            platform: Platform name (facebook, twitter, etc.)
            url: URL to validate

        Returns:
            Dict with valid (bool) and message (str)
        """
        if not url:
            return {"valid": False, "message": "URL is required"}

        # Check if platform is supported
        if platform not in SOCIAL_MEDIA_PATTERNS:
            return {"valid": False, "message": f"Unknown platform: {platform}"}

        # Validate URL pattern
        pattern = SOCIAL_MEDIA_PATTERNS[platform]
        if re.match(pattern, url, re.IGNORECASE):
            return {"valid": True, "message": "Valid URL"}

        return {
            "valid": False,
            "message": f"Invalid {platform} URL format. Expected pattern: {pattern}",
        }

    @staticmethod
    def normalize_social_media_url(platform: str, input_value: str) -> str:
        """Normalize social media handle/username to full URL.

        Args:
            platform: Platform name
            input_value: Handle, username, or full URL

        Returns:
            Full URL
        """
        # If already a full URL, return as-is (upgrade to HTTPS if HTTP)
        if input_value.startswith("http://") or input_value.startswith("https://"):
            return input_value.replace("http://", "https://")

        # Remove @ symbol if present
        value = input_value.lstrip("@")

        # Construct URL based on platform
        platform_bases = {
            "facebook": "https://facebook.com/",
            "twitter": "https://twitter.com/",
            "instagram": "https://instagram.com/",
            "linkedin": "https://linkedin.com/in/",
            "youtube": "https://youtube.com/@",
        }

        base = platform_bases.get(platform, "https://")
        return f"{base}{value}"

    @staticmethod
    def validate_social_media_links(links: dict[str, str]) -> dict[str, Any]:
        """Validate multiple social media links.

        Args:
            links: Dict of platform: url pairs

        Returns:
            Dict with valid (bool) and errors (dict of platform: message)
        """
        errors: dict[str, str] = {}

        for platform, url in links.items():
            result = BrandingService.validate_social_media_url(platform, url)
            if not result["valid"]:
                errors[platform] = result["message"]

        return {"valid": len(errors) == 0, "errors": errors}

    async def get_branding(self, db: AsyncSession, npo_id: uuid.UUID) -> NPOBranding:
        """Get branding for an NPO.

        Args:
            db: Database session
            npo_id: NPO ID

        Returns:
            NPOBranding instance

        Raises:
            NotFoundError: If NPO or branding not found
        """
        # Verify NPO exists
        npo_stmt = select(NPO).where(NPO.id == npo_id, NPO.deleted_at.is_(None))
        npo_result = await db.execute(npo_stmt)
        npo = npo_result.scalar_one_or_none()

        if not npo:
            logger.warning(f"NPO not found: {npo_id}")
            raise NotFoundError(f"NPO with ID {npo_id} not found")

        # Get branding
        stmt = select(NPOBranding).where(NPOBranding.npo_id == npo_id)
        result = await db.execute(stmt)
        branding = result.scalar_one_or_none()

        if not branding:
            # Create default branding if it doesn't exist
            logger.info(f"Creating default branding for NPO {npo_id}")
            branding = NPOBranding(npo_id=npo_id)
            db.add(branding)
            await db.commit()
            await db.refresh(branding)

        return branding

    async def update_branding(
        self,
        db: AsyncSession,
        npo_id: uuid.UUID,
        update_data: BrandingUpdateRequest,
    ) -> NPOBranding:
        """Update NPO branding.

        Args:
            db: Database session
            npo_id: NPO ID
            update_data: Branding update request

        Returns:
            Updated NPOBranding instance

        Raises:
            NotFoundError: If NPO not found
            ValidationError: If validation fails
        """
        # Get existing branding (creates if not exists)
        branding = await self.get_branding(db, npo_id)

        # Validate colors
        if update_data.primary_color:
            if not self.validate_hex_color(update_data.primary_color):
                raise ValidationError("Invalid primary color format")
            branding.primary_color = self.normalize_hex_color(update_data.primary_color)

        if update_data.secondary_color:
            if not self.validate_hex_color(update_data.secondary_color):
                raise ValidationError("Invalid secondary color format")
            branding.secondary_color = self.normalize_hex_color(update_data.secondary_color)

        # Check color pair contrast
        if branding.primary_color and branding.secondary_color:
            warning = self.check_color_pair_contrast(
                branding.primary_color, branding.secondary_color
            )
            if warning:
                logger.warning(f"Color contrast warning for NPO {npo_id}: {warning}")
                # Note: This is just a warning, not blocking

        # Update logo URL
        if update_data.logo_url is not None:
            branding.logo_url = update_data.logo_url

        # Validate and update social media links
        if update_data.social_media_links is not None:
            validation_result = self.validate_social_media_links(update_data.social_media_links)
            if not validation_result["valid"]:
                error_messages = ", ".join(
                    [f"{k}: {v}" for k, v in validation_result["errors"].items()]
                )
                raise ValidationError(f"Invalid social media URLs: {error_messages}")

            branding.social_media_links = update_data.social_media_links

        # Update custom CSS properties
        if update_data.custom_css_properties is not None:
            branding.custom_css_properties = update_data.custom_css_properties

        await db.commit()
        await db.refresh(branding)

        logger.info(f"Updated branding for NPO {npo_id}")
        return branding

    async def create_branding(
        self,
        db: AsyncSession,
        npo_id: uuid.UUID,
        branding_data: BrandingCreateRequest,
    ) -> NPOBranding:
        """Create branding for an NPO.

        Args:
            db: Database session
            npo_id: NPO ID
            branding_data: Branding creation request

        Returns:
            Created NPOBranding instance

        Raises:
            ValidationError: If validation fails
        """
        # Check if branding already exists
        stmt = select(NPOBranding).where(NPOBranding.npo_id == npo_id)
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            logger.info(f"Branding already exists for NPO {npo_id}, updating instead")
            return await self.update_branding(
                db,
                npo_id,
                BrandingUpdateRequest(**branding_data.model_dump(exclude_unset=True)),
            )

        # Validate colors
        primary_color = None
        if branding_data.primary_color:
            if not self.validate_hex_color(branding_data.primary_color):
                raise ValidationError("Invalid primary color format")
            primary_color = self.normalize_hex_color(branding_data.primary_color)

        secondary_color = None
        if branding_data.secondary_color:
            if not self.validate_hex_color(branding_data.secondary_color):
                raise ValidationError("Invalid secondary color format")
            secondary_color = self.normalize_hex_color(branding_data.secondary_color)

        # Validate social media links
        if branding_data.social_media_links:
            validation_result = self.validate_social_media_links(branding_data.social_media_links)
            if not validation_result["valid"]:
                error_messages = ", ".join(
                    [f"{k}: {v}" for k, v in validation_result["errors"].items()]
                )
                raise ValidationError(f"Invalid social media URLs: {error_messages}")

        # Create branding
        branding = NPOBranding(
            npo_id=npo_id,
            primary_color=primary_color,
            secondary_color=secondary_color,
            logo_url=branding_data.logo_url,
            social_media_links=branding_data.social_media_links,
            custom_css_properties=branding_data.custom_css_properties,
        )

        db.add(branding)
        await db.commit()
        await db.refresh(branding)

        logger.info(f"Created branding for NPO {npo_id}")
        return branding
