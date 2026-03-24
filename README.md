# Ticket Management System (Electron + React + Node.js)

A complete desktop-ready Ticket Management System with role-based access for **Admin**, **Technician**, and **User**.

## Tech Stack
- Electron.js (desktop shell)
- React + Vite (frontend)
- Node.js + Express (backend API)
- SQLite (local database with `better-sqlite3`)

## Roles & Features

### User
- Login
- Create tickets (title, description, priority, attachment)
- View own tickets
- Track status (`Open`, `In Progress`, `Closed`)

### Technician
- View assigned tickets
- Update ticket status
- Add comments/solutions
- Resolve tickets

### Admin
- Dashboard stats (total, pending, resolved, unassigned)
- View all tickets
- Assign tickets to technicians
- Manage users (add/edit/delete APIs)

## Ticket Capabilities
- Auto-generated ID (`TCK-0001` format)
- Priority (Low/Medium/High)
- Status tracking
- Timestamps (created/updated/resolved)
- File attachment upload
- Notification feed for ticket updates

## Default Users
- `admin` / `admin123`
- `tech1` / `tech123`
- `user1` / `user123`

## Run Locally
```bash
npm install
npm start
```

This starts:
- Backend API on `http://localhost:3001`
- React frontend on `http://localhost:5173`
- Electron desktop window

## Build Commands
```bash
npm run build
npm run electron-build
```

Windows `.exe` installer is generated via `electron-builder` under the release output directory.
