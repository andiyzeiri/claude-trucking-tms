# Claude Trucking TMS Frontend

A modern Next.js 14 frontend application for the Claude Trucking Transportation Management System (TMS).

## Features

- **Modern Stack**: Next.js 14 with App Router, TypeScript, and Tailwind CSS
- **UI Components**: shadcn/ui for consistent, accessible components
- **State Management**: React Query for server state and API communication
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: JWT-based authentication with automatic token management
- **Responsive Design**: Mobile-first responsive layout
- **Real-time Updates**: Optimistic updates and real-time data synchronization

## Pages

- **Dashboard**: Overview with key metrics and quick actions
- **Loads**: Manage shipments and deliveries
- **Drivers**: Driver roster management
- **Trucks**: Fleet vehicle management
- **Customers**: Customer relationship management
- **Login**: Authentication page

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser.

## API Integration

The frontend integrates with the Claude Trucking TMS backend API. Make sure the backend is running on `http://localhost:8000` before starting the frontend.

### Demo Credentials

For testing purposes, use:
- Email: `admin@example.com`
- Password: `password123`

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Authentication**: JWT tokens with js-cookie
- **Icons**: Lucide React
- **Notifications**: react-hot-toast

## Project Structure

```
src/
├── app/                 # Next.js 14 App Router pages
│   ├── dashboard/       # Dashboard page
│   ├── loads/          # Loads management
│   ├── drivers/        # Drivers management
│   ├── trucks/         # Trucks management
│   ├── customers/      # Customers management
│   ├── login/          # Login page
│   └── layout.tsx      # Root layout
├── components/
│   ├── ui/             # shadcn/ui components
│   └── layout/         # Layout components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── providers/          # React context providers
└── types/              # TypeScript type definitions
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Code Style

The project uses:
- ESLint with Next.js recommended rules
- TypeScript for type safety
- Prettier for code formatting (via ESLint)

## Deployment

The application can be deployed to any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Railway**
- **Docker**

Make sure to set the `NEXT_PUBLIC_API_URL` environment variable to point to your production API.