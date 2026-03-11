"""Fernet encryption helpers for sensitive payment credentials.

T014 — Phase 2.

Usage:
    from app.core.encryption import encrypt_credential, decrypt_credential

    ciphertext = encrypt_credential(plaintext_api_key)
    plaintext  = decrypt_credential(ciphertext)

The encryption key is read from the CREDENTIAL_ENCRYPTION_KEY env var at
first use (lazy-loaded). Generate a key with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken


class CredentialEncryptionError(Exception):
    """Raised when encryption/decryption fails."""


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """Return a cached Fernet instance, built from CREDENTIAL_ENCRYPTION_KEY."""
    from app.core.config import get_settings  # avoid circular import at module load

    settings = get_settings()
    key = settings.credential_encryption_key
    if not key:
        raise CredentialEncryptionError(
            "CREDENTIAL_ENCRYPTION_KEY is not set. "
            'Generate one with: python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise CredentialEncryptionError(f"Invalid CREDENTIAL_ENCRYPTION_KEY: {exc}") from exc


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a plaintext credential string using Fernet (AES-128-CBC + HMAC).

    Args:
        plaintext: The raw credential value to protect.

    Returns:
        URL-safe base64-encoded ciphertext string, suitable for DB storage.

    Raises:
        CredentialEncryptionError: If the encryption key is missing or invalid.
    """
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted credential string.

    Args:
        ciphertext: The base64-encoded ciphertext produced by `encrypt_credential()`.

    Returns:
        The original plaintext credential string.

    Raises:
        CredentialEncryptionError: If decryption fails (wrong key, tampered data, or
            token has expired — Fernet tokens are time-limited by default, but we
            create them without a TTL by calling `encrypt()` not `encrypt_at_time()`).
    """
    fernet = _get_fernet()
    try:
        return fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise CredentialEncryptionError(
            "Failed to decrypt credential. The CREDENTIAL_ENCRYPTION_KEY may have "
            "changed or the ciphertext is corrupted."
        ) from exc
