from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from models import User
from db import get_session
from security import (
    ACCESS_EXPIRE_MIN,
    create_token,
    verify_password,
    hash_password,
    decode_token,
)

router = APIRouter()


class AuthRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register")
def register(body: AuthRequest, session: Session = Depends(get_session)):
    existing = session.exec(
        select(User).where(User.username == body.username)
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )

    session.add(user)
    session.commit()

    return {"message": "User created"}


@router.post("/login")
def login(body: AuthRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where(User.username == body.username)
    ).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_token(body.username)
    refresh = create_token(body.username, refresh=True)

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_EXPIRE_MIN * 60,
    }


@router.post("/refresh")
def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)

        if payload.get("type") != "refresh":
            raise ValueError("Invalid token type")

        new_access = create_token(payload["sub"])
        return {"access_token": new_access}

    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
