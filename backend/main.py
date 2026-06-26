# ==========================================
# USER MANAGEMENT SYSTEM - PURE JWT + BEARER TOKEN
# FastAPI + MySQL + JWT + RBAC + Bcrypt
# ==========================================

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, EmailStr, Field
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional, List
import pymysql
import bcrypt

# ==========================================
# 1. DATABASE CONFIGURATION (MySQL)
# ==========================================
MYSQL_USER = "root"
MYSQL_PASSWORD = "root123"  # ️ CHANGE TO YOUR MYSQL PASSWORD
MYSQL_HOST = "localhost"
MYSQL_DB = "user_management_db"

# Auto-create database
try:
    temp_conn = pymysql.connect(host=MYSQL_HOST, user=MYSQL_USER, password=MYSQL_PASSWORD)
    temp_cursor = temp_conn.cursor()
    temp_cursor.execute(f"CREATE DATABASE IF NOT EXISTS {MYSQL_DB}")
    temp_conn.close()
    print(f"✅ Database '{MYSQL_DB}' created successfully!")
except Exception as e:
    print(f"❌ Database error: {e}")

DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}/{MYSQL_DB}"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 2. JWT & SECURITY CONFIG
# ==========================================
SECRET_KEY = "your_super_secret_jwt_key_change_in_production_2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# HTTPBearer automatically extracts "Authorization: Bearer <token>" from the header
security = HTTPBearer()

# --- PASSWORD HASHING (Bcrypt) ---
def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# ==========================================
# 3. JWT TOKEN CREATION & DECODING
# ==========================================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Bearer Token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ==========================================
# 4. DATABASE MODEL
# ==========================================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="user", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

Base.metadata.create_all(bind=engine)
print("✅ Database tables created successfully!")

# ==========================================
# 5. PYDANTIC SCHEMAS
# ==========================================
class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Optional[str] = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str
    role: str
    name: str

# ==========================================
# 6. FASTAPI APP SETUP
# ==========================================
app = FastAPI(
    title="User Management System API",
    description="REST API with JWT Bearer Token Authentication & RBAC",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# ==========================================
# 7. BEARER TOKEN & RBAC DEPENDENCIES
# ==========================================
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> dict:
    """
    1. HTTPBearer automatically extracts the token from 'Authorization: Bearer <token>'
    2. We decode the JWT token to get the user's role and ID.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    
    user_id = payload.get("user_id")
    email = payload.get("email")
    role = payload.get("role")
    
    if not user_id or not email or not role:
        raise HTTPException(status_code=401, detail="Invalid Bearer Token payload")
    
    # Verify user still exists in DB
    user = db.query(User).filter(User.id == user_id, User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return {"user_id": user_id, "email": email, "role": role, "name": user.name}

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    RBAC: Checks the 'role' inside the Bearer Token.
    If the token does not contain role='admin', access is denied.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Admin Bearer Token required."
        )
    return current_user

# ==========================================
# 8. API ENDPOINTS
# ==========================================

@app.get("/", tags=["System"])
def root():
    return {"message": "API is running. Use Bearer Token for protected routes."}

# --- AUTH ENDPOINTS ---
@app.post("/register", response_model=UserResponse, status_code=201, tags=["Authentication"])
def register(user: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        name=user.name, email=user.email,
        hashed_password=get_password_hash(user.password),
        role=user.role if user.role in ["admin", "user"] else "user"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=Token, tags=["Authentication"])
def login(user: UserLogin, db: Session = Depends(get_db)):
    """
    Validates credentials and RETURNS the Bearer Token.
    """
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Generate JWT Token
    access_token = create_access_token(
        data={
            "user_id": db_user.id,
            "email": db_user.email,
            "role": db_user.role,
            "name": db_user.name
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": db_user.id,
        "email": db_user.email,
        "role": db_user.role,
        "name": db_user.name
    }

# --- PROTECTED USER CRUD ENDPOINTS ---

@app.get("/users", response_model=List[UserResponse], tags=["Users - Admin Only"])
def get_all_users(current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """
    PROTECTED: Requires Bearer Token with role='admin'
    """
    return db.query(User).all()

@app.get("/users/{user_id}", response_model=UserResponse, tags=["Users"])
def get_user_by_id(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    PROTECTED: Requires any valid Bearer Token.
    - Admin can view anyone.
    - User can only view themselves.
    """
    if current_user["role"] != "admin" and current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access Denied: You can only view your own profile.")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/users/{user_id}", response_model=UserResponse, tags=["Users - Admin Only"])
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    PROTECTED: Requires Bearer Token with role='admin'
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.name: user.name = user_update.name
    if user_update.email:
        existing = db.query(User).filter(User.email == user_update.email).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_update.email
    if user_update.role:
        user.role = user_update.role if user_update.role in ["admin", "user"] else "user"
    
    db.commit()
    db.refresh(user)
    return user

@app.delete("/users/{user_id}", tags=["Users - Admin Only"])
def delete_user(
    user_id: int,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    PROTECTED: Requires Bearer Token with role='admin'
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Admin cannot delete their own account")
    
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}