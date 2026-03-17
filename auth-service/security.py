from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt
import os

SECRET_KEY = os.getenv("JWT_SECRET", "change-me")
ALGORITHM = os.getenv("JWT_ALGO", "HS256")
ACCESS_EXPIRE_MIN = int(os.getenv("ACCESS_TOKEN_EXPIRES_MIN", 60))
REFRESH_EXPIRE_MIN = int(os.getenv("REFRESH_TOKEN_EXPIRES_MIN", 43200))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hash_: str) -> bool:
    return pwd_context.verify(password, hash_)


def create_token(sub: str, refresh: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=REFRESH_EXPIRE_MIN if refresh else ACCESS_EXPIRE_MIN
    )

    payload = {
        "sub": sub,
        "exp": expire,
        "type": "refresh" if refresh else "access",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
