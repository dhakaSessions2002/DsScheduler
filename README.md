Live link:
https://ds-scheduler.vercel.app/login

# DS Scheduler — Dhaka Sessions Task Scheduler

A full-stack Next.js + MongoDB task scheduling application for **Dhaka Sessions**. Admin manages upload tasks across YouTube, Spotify, Instagram, Snapchat, and Facebook — assigning them to team members with deadlines, leave management, and notifications.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, Radix UI, Lucide Icons
- **Backend**: Next.js API Routes
- **Database**: MongoDB (via Mongoose)
- **Auth**: JWT (jsonwebtoken + bcryptjs)

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running locally or a MongoDB Atlas connection string

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and update the values:

```bash
cp .env.example .env.local
```

Key variables:
- `MONGODB_URI` — MongoDB connection string (default: `mongodb://localhost:27017/ds-scheduler`)
- `JWT_SECRET` — Secret key for JWT tokens (change in production!)
- `ADMIN_EMAIL` — Admin account email (default: `admin@dhakasessions.com`)
- `ADMIN_PASSWORD` — Admin account password (default: `admin123`)

### 3. Start MongoDB

Make sure MongoDB is running. If using MongoDB locally:

```bash
mongod
```

Or use [MongoDB Atlas](https://www.mongodb.com/atlas) for a cloud database.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. First Login

The admin account is automatically created on first login attempt using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env.local`.

- **Admin login**: Use `admin@dhakasessions.com` / `admin123`
- **Employee registration**: Go to `/register` to create an employee account (requires admin approval)

## Features

- **Admin Dashboard**: Create and assign upload tasks, manage team, handle leave requests
- **Employee Dashboard**: View assigned tasks, mark tasks complete, request leave
- **Master Calendar**: Visual timeline of all upcoming tasks
- **Employee Access Control**: Admin approves/denies/removes employee access
- **Leave Management**: Employees request leave, admin approves/rejects
- **Notifications**: Real-time alerts for task assignments, completions, and leave status updates
- **Responsive Design**: Works on desktop and mobile

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project on [Vercel](https://vercel.com)
3. Set environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

Build the production bundle:

```bash
npm run build
npm start
```

The app runs on port 3000 by default.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── studio/        # Task/data CRUD operations
│   │   └── access/        # Employee access management
│   ├── login/             # Login page
│   ├── register/          # Registration page
│   ├── forgot-password/   # Password reset request
│   ├── reset-password/    # Password reset form
│   ├── layout.js          # Root layout
│   └── page.js            # Home page (dashboard)
├── components/            # React components
│   ├── pages/             # Page-level components
│   ├── ui/                # Shadcn UI components
│   └── ...                # Feature components
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities (auth, db, status)
├── models/                # Mongoose models
└── api/                   # API client
```
