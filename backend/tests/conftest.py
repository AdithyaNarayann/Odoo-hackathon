import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend directory is in sys.path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.core.database import Base, get_db
from app.main import app
from app.models import *  # noqa: F401, F403

# Use in-memory SQLite with StaticPool for fast, isolated tests
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_tokens(db_session):
    from app.core.security import create_access_token, hash_password
    from app.models.customer import Customer
    from app.models.user import User

    # Create Admin
    admin = User(
        email="admin_role@example.com",
        full_name="Admin User",
        hashed_password=hash_password("Admin@12345"),
        role="admin",
        is_active=True,
    )
    # Create Staff
    staff = User(
        email="staff_role@example.com",
        full_name="Staff User",
        hashed_password=hash_password("Staff@12345"),
        role="staff",
        is_active=True,
    )
    # Create Customer 1
    cust1_user = User(
        email="cust1@example.com",
        full_name="Customer One",
        hashed_password=hash_password("Cust1@12345"),
        role="customer",
        is_active=True,
    )
    # Create Customer 2
    cust2_user = User(
        email="cust2@example.com",
        full_name="Customer Two",
        hashed_password=hash_password("Cust2@12345"),
        role="customer",
        is_active=True,
    )
    db_session.add_all([admin, staff, cust1_user, cust2_user])
    db_session.flush()

    c1 = Customer(name="Customer One", company_name="Corp 1", email=cust1_user.email, user_id=cust1_user.id)
    c2 = Customer(name="Customer Two", company_name="Corp 2", email=cust2_user.email, user_id=cust2_user.id)
    db_session.add_all([c1, c2])
    db_session.commit()

    return {
        "admin": create_access_token({"sub": str(admin.id), "role": "admin"}),
        "staff": create_access_token({"sub": str(staff.id), "role": "staff"}),
        "cust1": create_access_token({"sub": str(cust1_user.id), "role": "customer"}),
        "cust2": create_access_token({"sub": str(cust2_user.id), "role": "customer"}),
        "c1_id": c1.id,
        "c2_id": c2.id,
    }
