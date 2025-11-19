from sqlmodel import SQLModel, Field
from typing import Optional

class User(SQLModel, table=True):
    """
    Modèle SQLModel représentant un utilisateur.
    - id : clé primaire auto-incrémentée
    - username : identifiant unique
    - password_hash : hash sécurisé du mot de passe
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str