"""
Tests unitaires du module security.py

Vérifie le comportement des fonctions de hashage (bcrypt) et de gestion
des JWT sans dépendance à la base de données ou au serveur HTTP.
Pattern AAA : Arrange / Act / Assert.
"""

import pytest
import jwt as pyjwt
from datetime import datetime, timedelta, timezone

from security import (
    hash_password,
    verify_password,
    create_token,
    decode_token,
    SECRET_KEY,
    ALGORITHM,
)


# ─────────────────────────────────────────────────────────────────
# Hashage de mots de passe
# ─────────────────────────────────────────────────────────────────


class TestHashPassword:
    """Tests des fonctions hash_password et verify_password."""

    def test_hash_different_from_plain(self):
        """Le hash ne doit jamais être identique au mot de passe en clair."""
        # Arrange
        plain = "MonMotDePasse123!"
        # Act
        hashed = hash_password(plain)
        # Assert
        assert hashed != plain

    def test_correct_password_verifies(self):
        """verify_password doit retourner True pour le bon mot de passe."""
        # Arrange
        plain = "MonMotDePasse123!"
        hashed = hash_password(plain)
        # Act & Assert
        assert verify_password(plain, hashed) is True

    def test_wrong_password_rejected(self):
        """verify_password doit retourner False pour un mauvais mot de passe."""
        # Arrange
        plain = "MonMotDePasse123!"
        hashed = hash_password(plain)
        # Act & Assert
        assert verify_password("mauvais_mdp", hashed) is False

    def test_two_hashes_of_same_password_differ(self):
        """
        bcrypt est salé : deux hashes du même mot de passe sont toujours différents.
        Vérifie que hash_password ne produit pas un hash déterministe.
        """
        # Arrange
        plain = "MonMotDePasse123!"
        # Act
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)
        # Assert
        assert hash1 != hash2


# ─────────────────────────────────────────────────────────────────
# Tokens JWT
# ─────────────────────────────────────────────────────────────────


class TestCreateToken:
    """Tests de la fonction create_token."""

    def test_returns_non_empty_string(self):
        """create_token doit retourner une chaîne non vide."""
        # Act
        token = create_token("alice")
        # Assert
        assert isinstance(token, str)
        assert len(token) > 0

    def test_access_token_type(self):
        """Un token access doit avoir le champ type = 'access'."""
        # Act
        token = create_token("alice")
        payload = decode_token(token)
        # Assert
        assert payload["type"] == "access"

    def test_refresh_token_type(self):
        """Un token refresh doit avoir le champ type = 'refresh'."""
        # Act
        token = create_token("alice", refresh=True)
        payload = decode_token(token)
        # Assert
        assert payload["type"] == "refresh"

    def test_subject_is_preserved(self):
        """Le champ 'sub' du payload doit correspondre au username passé."""
        # Act
        token = create_token("alice")
        payload = decode_token(token)
        # Assert
        assert payload["sub"] == "alice"


class TestDecodeToken:
    """Tests de la fonction decode_token."""

    def test_decode_valid_token(self):
        """decode_token doit retourner le payload complet d'un token valide."""
        # Arrange
        token = create_token("bob")
        # Act
        payload = decode_token(token)
        # Assert
        assert payload["sub"] == "bob"
        assert "exp" in payload
        assert "type" in payload

    def test_expired_token_raises(self):
        """
        Un token expiré doit lever ExpiredSignatureError.
        On forge manuellement un token avec une expiration dans le passé.
        """
        # Arrange
        expired_payload = {
            "sub": "alice",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "type": "access",
        }
        expired_token = pyjwt.encode(
            expired_payload, SECRET_KEY, algorithm=ALGORITHM
        )
        # Act & Assert
        with pytest.raises(pyjwt.ExpiredSignatureError):
            decode_token(expired_token)

    def test_tampered_token_raises(self):
        """
        Un token dont la signature a été altérée doit lever InvalidTokenError.
        """
        # Arrange
        token = create_token("alice")
        tampered = token[:-5] + "XXXXX"
        # Act & Assert
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_token(tampered)

    def test_wrong_secret_raises(self):
        """Un token signé avec une clé différente doit être rejeté."""
        # Arrange
        fake_payload = {
            "sub": "alice",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
            "type": "access",
        }
        fake_token = pyjwt.encode(
            fake_payload, "mauvaise-cle", algorithm=ALGORITHM
        )
        # Act & Assert
        with pytest.raises(pyjwt.InvalidTokenError):
            decode_token(fake_token)
