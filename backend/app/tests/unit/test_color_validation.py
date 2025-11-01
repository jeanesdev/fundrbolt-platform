"""Unit tests for branding color validation.

Tests color format validation, contrast checking, and accessibility compliance.
"""

import pytest

from app.services.branding_service import BrandingService


class TestColorValidation:
    """Unit tests for color format validation."""

    def test_valid_hex_colors_pass_validation(self):
        """Test valid hex color formats pass validation."""
        valid_colors = [
            "#000000",  # Black
            "#FFFFFF",  # White
            "#FF5733",  # Custom color
            "#33FF57",  # Custom color
            "#123456",  # Custom color
            "#ABCDEF",  # Uppercase
            "#abcdef",  # Lowercase
            "#AB12EF",  # Mixed case
        ]

        for color in valid_colors:
            assert BrandingService.validate_hex_color(color) is True, f"{color} should be valid"

    def test_invalid_hex_colors_fail_validation(self):
        """Test invalid hex color formats fail validation."""
        invalid_colors = [
            "000000",  # Missing #
            "#00000",  # Too short
            "#0000000",  # Too long
            "#GGGGGG",  # Invalid hex chars
            "red",  # Named color
            "#FF-733",  # Invalid character
            "##FF5733",  # Double #
            "#FF 5733",  # Space
            "",  # Empty
            None,  # None
        ]

        for color in invalid_colors:
            assert BrandingService.validate_hex_color(color) is False, f"{color} should be invalid"

    def test_color_validation_normalizes_to_uppercase(self):
        """Test color validation normalizes to uppercase."""
        lowercase_colors = {
            "#ff5733": "#FF5733",
            "#abcdef": "#ABCDEF",
            "#123abc": "#123ABC",
        }

        for input_color, expected_color in lowercase_colors.items():
            normalized = BrandingService.normalize_hex_color(input_color)
            assert normalized == expected_color

    def test_color_validation_preserves_uppercase(self):
        """Test uppercase colors are preserved."""
        uppercase_colors = ["#FF5733", "#ABCDEF", "#123ABC"]

        for color in uppercase_colors:
            normalized = BrandingService.normalize_hex_color(color)
            assert normalized == color


class TestContrastValidation:
    """Unit tests for color contrast checking (accessibility)."""

    def test_calculate_contrast_ratio(self):
        """Test contrast ratio calculation."""
        # Black on white = 21:1 (maximum)
        ratio = BrandingService.calculate_contrast_ratio("#000000", "#FFFFFF")
        assert ratio == pytest.approx(21.0, abs=0.1)

        # White on black = 21:1
        ratio = BrandingService.calculate_contrast_ratio("#FFFFFF", "#000000")
        assert ratio == pytest.approx(21.0, abs=0.1)

        # Same color = 1:1 (minimum)
        ratio = BrandingService.calculate_contrast_ratio("#FF5733", "#FF5733")
        assert ratio == pytest.approx(1.0, abs=0.1)

    def test_high_contrast_colors_pass_wcag_aa(self):
        """Test high contrast color pairs pass WCAG AA standard (4.5:1)."""
        # Black on white
        assert BrandingService.check_contrast_wcag_aa("#000000", "#FFFFFF") is True

        # Dark blue on white
        assert BrandingService.check_contrast_wcag_aa("#003366", "#FFFFFF") is True

        # White on dark red
        assert BrandingService.check_contrast_wcag_aa("#FFFFFF", "#8B0000") is True

    def test_low_contrast_colors_fail_wcag_aa(self):
        """Test low contrast color pairs fail WCAG AA standard."""
        # Light gray on white
        assert BrandingService.check_contrast_wcag_aa("#CCCCCC", "#FFFFFF") is False

        # Yellow on white
        assert BrandingService.check_contrast_wcag_aa("#FFFF00", "#FFFFFF") is False

        # Light blue on white
        assert BrandingService.check_contrast_wcag_aa("#87CEEB", "#FFFFFF") is False

    def test_contrast_warning_for_primary_secondary_pair(self):
        """Test contrast warning when primary/secondary colors have low contrast."""
        # Similar colors - low contrast
        warning = BrandingService.check_color_pair_contrast(primary="#FF5733", secondary="#FF6644")
        assert warning is not None
        assert "contrast" in warning.lower()

        # High contrast colors
        warning = BrandingService.check_color_pair_contrast(primary="#000000", secondary="#FFFFFF")
        assert warning is None


class TestColorAccessibility:
    """Unit tests for color accessibility features."""

    def test_detect_insufficient_contrast_for_text(self):
        """Test detection of insufficient contrast for text readability."""
        # Light text on light background
        result = BrandingService.validate_text_contrast(
            text_color="#CCCCCC", background_color="#FFFFFF"
        )
        assert result["valid"] is False
        assert "contrast" in result["message"].lower()

        # Dark text on light background
        result = BrandingService.validate_text_contrast(
            text_color="#000000", background_color="#FFFFFF"
        )
        assert result["valid"] is True

    def test_suggest_alternative_colors_for_low_contrast(self):
        """Test system suggests alternative colors for better contrast."""
        suggestions = BrandingService.suggest_color_alternatives(
            base_color="#FFFF00",  # Yellow - poor contrast on white
            background="#FFFFFF",
        )

        assert len(suggestions) > 0
        # All suggestions should have better contrast
        for suggestion in suggestions:
            ratio = BrandingService.calculate_contrast_ratio(suggestion, "#FFFFFF")
            assert ratio >= 4.5  # WCAG AA minimum

    def test_color_blindness_simulation(self):
        """Test color appearance for different types of color blindness."""
        # Deuteranopia (red-green color blindness)
        simulated = BrandingService.simulate_color_blindness(
            "#FF0000", color_blindness_type="deuteranopia"
        )
        assert simulated != "#FF0000"  # Should be different

        # Protanopia
        simulated = BrandingService.simulate_color_blindness(
            "#00FF00", color_blindness_type="protanopia"
        )
        assert simulated != "#00FF00"

        # Tritanopia
        simulated = BrandingService.simulate_color_blindness(
            "#0000FF", color_blindness_type="tritanopia"
        )
        assert simulated != "#0000FF"
