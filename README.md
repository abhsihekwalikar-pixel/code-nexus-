# User Management System

A simple user management application with a FastAPI backend and a static frontend.

## Project Structure

- backend/ - FastAPI API and database setup
- frontend/ - HTML, CSS, and JavaScript for the client UI

## Backend Setup

1. Make sure MySQL is running and create a database named `user_management_db`.
2. Update the MySQL credentials in `backend/main.py` if needed.
3. Install Python dependencies:

```bash
pip install -r backend/requirements.txt
```

4. Start the API server:

```bash
cd backend
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

## Frontend Setup

Open `frontend/index.html` in a browser, or serve the folder with a simple static server if needed.

## Notes

- The backend uses JWT bearer authentication and role-based access control.
- The default admin/user flows are implemented in the API endpoints.
