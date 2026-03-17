from sqlmodel import create_engine, SQLModel, Session, select
import os

from models import User
from security import hash_password

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/db/auth.db")

engine = create_engine(DATABASE_URL, echo=False)


def init_db():
    SQLModel.metadata.create_all(engine)
    _seed_admin()


def _seed_admin():
    with Session(engine) as session:
        if session.exec(select(User).where(User.username == "admin")).first():
            return
        session.add(User(username="admin", password_hash=hash_password("admin")))
        session.commit()


def get_session():
    with Session(engine) as session:
        yield session
