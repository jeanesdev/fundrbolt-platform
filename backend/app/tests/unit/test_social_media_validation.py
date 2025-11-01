"""Unit tests for social media URL validation.

Tests validation of platform-specific URL formats for Facebook, Twitter, Instagram, etc.
"""

from app.services.branding_service import BrandingService


class TestSocialMediaURLValidation:
    """Unit tests for social media URL format validation."""

    def test_valid_facebook_urls(self):
        """Test valid Facebook URL formats."""
        valid_urls = [
            "https://facebook.com/testnpo",
            "https://www.facebook.com/testnpo",
            "https://fb.com/testnpo",
            "https://www.facebook.com/pages/test-npo/123456789",
            "https://facebook.com/testnpo123",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("facebook", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_facebook_urls(self):
        """Test invalid Facebook URLs."""
        invalid_urls = [
            "https://twitter.com/testnpo",  # Wrong platform
            "https://facebook.com",  # No username
            "not-a-url",  # Invalid URL format
            "http://malicious-site.com/facebook",  # Spoofed
            "",  # Empty
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("facebook", url)
            assert result["valid"] is False, f"{url} should be invalid"

    def test_valid_twitter_urls(self):
        """Test valid Twitter/X URL formats."""
        valid_urls = [
            "https://twitter.com/testnpo",
            "https://www.twitter.com/testnpo",
            "https://x.com/testnpo",
            "https://www.x.com/testnpo",
            "https://twitter.com/test_npo",
            "https://twitter.com/TestNPO123",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("twitter", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_twitter_urls(self):
        """Test invalid Twitter URLs."""
        invalid_urls = [
            "https://facebook.com/testnpo",  # Wrong platform
            "https://twitter.com",  # No username
            "https://twitter.com/@testnpo",  # @ symbol (not in URL)
            "not-a-url",
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("twitter", url)
            assert result["valid"] is False, f"{url} should be invalid"

    def test_valid_instagram_urls(self):
        """Test valid Instagram URL formats."""
        valid_urls = [
            "https://instagram.com/testnpo",
            "https://www.instagram.com/testnpo",
            "https://instagram.com/test_npo",
            "https://instagram.com/test.npo",
            "https://instagram.com/testnpo123",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("instagram", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_instagram_urls(self):
        """Test invalid Instagram URLs."""
        invalid_urls = [
            "https://twitter.com/testnpo",  # Wrong platform
            "https://instagram.com",  # No username
            "not-a-url",
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("instagram", url)
            assert result["valid"] is False, f"{url} should be invalid"

    def test_valid_linkedin_urls(self):
        """Test valid LinkedIn URL formats."""
        valid_urls = [
            "https://linkedin.com/company/testnpo",
            "https://www.linkedin.com/company/testnpo",
            "https://linkedin.com/in/john-doe",
            "https://www.linkedin.com/in/john-doe-123",
            "https://linkedin.com/company/test-npo-org",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("linkedin", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_linkedin_urls(self):
        """Test invalid LinkedIn URLs."""
        invalid_urls = [
            "https://facebook.com/testnpo",  # Wrong platform
            "https://linkedin.com",  # No company/profile
            "not-a-url",
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("linkedin", url)
            assert result["valid"] is False, f"{url} should be invalid"

    def test_valid_youtube_urls(self):
        """Test valid YouTube URL formats."""
        valid_urls = [
            "https://youtube.com/c/testnpo",
            "https://www.youtube.com/c/testnpo",
            "https://youtube.com/@testnpo",
            "https://www.youtube.com/@testnpo",
            "https://youtube.com/channel/UC123456789",
            "https://youtube.com/user/testnpo",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("youtube", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_youtube_urls(self):
        """Test invalid YouTube URLs."""
        invalid_urls = [
            "https://vimeo.com/testnpo",  # Wrong platform
            "https://youtube.com",  # No channel
            "not-a-url",
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("youtube", url)
            assert result["valid"] is False, f"{url} should be invalid"

    def test_valid_custom_website_urls(self):
        """Test valid custom website URLs."""
        valid_urls = [
            "https://testnpo.org",
            "https://www.testnpo.org",
            "https://testnpo.com",
            "https://test-npo.org",
            "https://testnpo.org/about",
        ]

        for url in valid_urls:
            result = BrandingService.validate_social_media_url("website", url)
            assert result["valid"] is True, f"{url} should be valid"

    def test_invalid_custom_website_urls(self):
        """Test invalid custom website URLs."""
        invalid_urls = [
            "not-a-url",
            "htp://invalid-protocol.com",  # Invalid protocol
            "ftp://file-server.com",  # FTP not allowed
            "",
        ]

        for url in invalid_urls:
            result = BrandingService.validate_social_media_url("website", url)
            assert result["valid"] is False, f"{url} should be invalid"


class TestSocialMediaLinkNormalization:
    """Unit tests for social media URL normalization."""

    def test_normalize_twitter_handle_to_url(self):
        """Test converting Twitter handle to full URL."""
        handle = "@testnpo"
        normalized = BrandingService.normalize_social_media_url("twitter", handle)
        assert normalized == "https://twitter.com/testnpo"

        handle = "testnpo"  # Without @
        normalized = BrandingService.normalize_social_media_url("twitter", handle)
        assert normalized == "https://twitter.com/testnpo"

    def test_normalize_instagram_handle_to_url(self):
        """Test converting Instagram handle to full URL."""
        handle = "@testnpo"
        normalized = BrandingService.normalize_social_media_url("instagram", handle)
        assert normalized == "https://instagram.com/testnpo"

    def test_normalize_facebook_username_to_url(self):
        """Test converting Facebook username to full URL."""
        username = "testnpo"
        normalized = BrandingService.normalize_social_media_url("facebook", username)
        assert normalized == "https://facebook.com/testnpo"

    def test_normalize_preserves_full_urls(self):
        """Test normalization preserves already valid full URLs."""
        url = "https://twitter.com/testnpo"
        normalized = BrandingService.normalize_social_media_url("twitter", url)
        assert normalized == url

    def test_normalize_adds_https_to_http_urls(self):
        """Test normalization upgrades HTTP to HTTPS."""
        http_url = "http://testnpo.org"
        normalized = BrandingService.normalize_social_media_url("website", http_url)
        assert normalized == "https://testnpo.org"


class TestSocialMediaLinksBatch:
    """Unit tests for batch validation of social media links."""

    def test_validate_multiple_links_success(self):
        """Test validating multiple social media links."""
        links = {
            "facebook": "https://facebook.com/testnpo",
            "twitter": "https://twitter.com/testnpo",
            "instagram": "https://instagram.com/testnpo",
            "website": "https://testnpo.org",
        }

        result = BrandingService.validate_social_media_links(links)
        assert result["valid"] is True
        assert len(result["errors"]) == 0

    def test_validate_multiple_links_with_errors(self):
        """Test validation reports errors for invalid links."""
        links = {
            "facebook": "https://facebook.com/testnpo",
            "twitter": "not-a-url",  # Invalid
            "instagram": "https://twitter.com/testnpo",  # Wrong platform
        }

        result = BrandingService.validate_social_media_links(links)
        assert result["valid"] is False
        assert len(result["errors"]) == 2
        assert "twitter" in result["errors"]
        assert "instagram" in result["errors"]

    def test_validate_empty_links_dict(self):
        """Test validation passes for empty links dict."""
        links = {}
        result = BrandingService.validate_social_media_links(links)
        assert result["valid"] is True

    def test_validate_unknown_platform_rejected(self):
        """Test validation rejects unknown social media platforms."""
        links = {
            "myspace": "https://myspace.com/testnpo",  # Unsupported platform
        }

        result = BrandingService.validate_social_media_links(links)
        assert result["valid"] is False
        assert "myspace" in result["errors"]
