"""SuperAdmin 계정 시드 — 최초 1회 실행"""
import os
from dotenv import load_dotenv
load_dotenv()

from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import User
from services.auth_service import hash_password

create_db_and_tables()

username = os.getenv("SUPERADMIN_USERNAME", "admin")
password = os.getenv("SUPERADMIN_PASSWORD", "admin1234")

with Session(engine) as session:
    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        print(f"SuperAdmin '{username}' already exists.")
    else:
        user = User(
            username=username,
            email=f"{username}@twinverse.org",
            hashed_password=hash_password(password),
            role="superadmin",
        )
        session.add(user)
        session.commit()
        print(f"SuperAdmin '{username}' created.")
