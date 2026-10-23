# App for Hand Holding

## Project Overview
A full-stack mentor-mentee platform for college internships and mentorship programs.

## Directory Structure
```
D:\mini\
  server/    # Node.js/Express backend
  client/    # React/Vite frontend
```

## Backend Setup
```bash
cd D:\mini\server
npm install
# Create .env file with:
#   MONGOMS_MD5_CHECK=false
#   JWT_SECRET=hand-holding-dev-secret
npm run dev
# Server runs on http://localhost:5000
```

## Frontend Setup
```bash
cd D:\mini\client
npm install
npm run dev
# App available at http://localhost:5173
```

## API Base URL
- Development: `http://localhost:5000`
- Vite proxies `/api/*` to the backend automatically

## Authentication
- Register: `POST /api/auth/register` with `name, email, password, role`
- Login: `POST /api/auth/login` with `email, password`
- Password change: `POST /api/auth/change-password` with `oldPassword, newPassword`
- Forgot password: `POST /api/auth/forgot` with `email`
- Reset password: `POST /api/auth/reset` with `token, password`

## Admin-created Users
1. Admin logs in at `/login`
2. Admin Dashboard shows "Add User" button
3. Fill form: fullName, email, password, role (mentor/mentee), bio, skills (mentor only), availability (mentor only)
4. Submit to create user immediately
5. New user can log in with assigned credentials

## Core Features
- Mentor discovery and filtering (by name, department, company, skills, type)
- Connection requests and acceptance
- Meeting creation, scheduling, completion, and rescheduling
- Goals creation, tracking, and status updates
- Messaging between connected mentor-mentee pairs
- Notifications for connections, meetings, and feedback
- Profile management and availability updates

## Test Commands
```bash
# Backend (if tests exist)
cd D:\mini\server && npm test

# Frontend build (must pass with zero warnings)
cd D:\mini\client && npm run build

# API smoke test (41 checks)
# (run as part of existing test suite)

# Browser E2E
node "C:\Users\LENOVO\AppData\Local\Temp\opencode\e2e\run.mjs"
# Results: 35/35 PASS (or 37/37 depending on suite)
```

## Environment Variables
Create `.env` in `D:\mini\server\`:
```
MONGOMS_MD5_CHECK=false
JWT_SECRET=hand-holding-dev-secret
# Optional CORS:
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Production Configuration
- Set `NODE_ENV=production`
- Tighten `CORS_ALLOWED_ORIGINS` to production domain(s)
- Change `JWT_SECRET` to a secure random value
- Use a proper MongoDB connection string (not just the memory server)
- Ensure frontend production build passes: `npm run build` (zero warnings)

## Demo Workflow
1. Start backend: `cd D:\mini\server && npm run dev`
2. Start frontend: `cd D:\mini\client && npm run dev`
3. Admin login: `admin@srms.edu / password123`
4. Create mentor/mentee via Admin Dashboard → Add User
5. New user logs in with assigned credentials
6. Explore features: find mentors, send requests, schedule meetings, set goals

## Security
- Passwords hashed with bcrypt, never stored in plaintext
- JWT tokens contain only `id`, `role`, `name`
- Admin-only endpoints protected by role check
- Public registration creates mentee accounts only
- CORS configured for development origins; tighten for production
- No email delivery infrastructure - password reset tokens generated but no emails sent