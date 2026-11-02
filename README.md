# Attendly

Attendly is a modern attendance management web application designed for workplaces and teams that want a faster, more secure way to track employee presence. It combines a clean dashboard, employee records, and real-time face verification to simplify check-ins and reduce manual attendance work.

This project is built with Next.js and TypeScript, and it uses face recognition to verify people live through a browser camera.

## What this app does

- Tracks attendance through a simple dashboard
- Shows employee presence and status at a glance
- Lets admins manage people and workspace details
- Uses face verification for quick identity checks
- Stores workspace data in MongoDB
- Exports attendance records and reports in CSV format
- Gives a modern admin panel experience for everyday use

## Main features

### 1. Dashboard overview
The app includes an overview page with key metrics like:
- total people
- present today
- late arrivals
- attendance trends
- recent verification activity

### 2. Attendance tracking
Users can:
- review all attendance records
- filter by status, department, or location
- export attendance data for reporting

### 3. People management
Admins can:
- add team members
- manage enrollment status
- track consent and department info
- search and filter people data

### 4. Face verification
Using the browser camera and `face-api.js`, the app can:
- detect a face in real time
- capture multiple angles for better recognition
- compare the captured face to known employee data
- mark attendance when a match is found

### 5. Workspace settings
The application supports workplace configuration such as:
- workspace name
- timezone
- privacy and consent preferences
- device settings
- notifications

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- `face-api.js` for face recognition
- MongoDB for persistent data storage
- Vercel Analytics

## Project structure

```bash
.
├── app/
│   ├── api/
│   │   └── workspace/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
├── lib/
├── public/
├── .gitignore
├── components.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── pnpm-lock.yaml
└── README.md
```

### Key folders

- `app/` – main application pages and routes
- `app/api/workspace/` – API for reading and saving workspace data
- `components/` – reusable UI components
- `lib/` – shared utilities and server-side helpers
- `public/` – static assets and browser-accessible files

## How the app works

1. The user opens the dashboard in the browser.
2. Admins can manage team members and workspace settings.
3. When a face verification process begins, the browser asks for camera access.
4. The app captures several face positions and compares them with stored employee biometric data.
5. If the face matches a known person, the system marks attendance and updates the dashboard.
6. Attendance records are saved to MongoDB and available for reporting.

## Prerequisites

Before running the app, make sure you have:

- Node.js 18 or later
- npm or pnpm
- MongoDB instance or MongoDB Atlas connection
- A browser with camera access enabled

## Setup and installation

### 1. Clone the repository

```bash
git clone https://github.com/sovondas414-code/Sovon-KavenOp.git
cd Sovon-KavenOp
```

### 2. Install dependencies

Using npm:

```bash
npm install
```

Or using pnpm:

```bash
pnpm install
```

### 3. Create environment variables
Create a `.env.local` file in the project root and add your database settings:

```bash
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=attendly
```

Example:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mydatabase
MONGODB_DB=attendly
```

### 4. Make sure model files are available
The face verification feature expects face recognition model files to be available under the public folder (for example under `/public/models`).

If your project is missing those files, face verification may not work correctly until the models are added.

## Run the app locally

```bash
npm run dev
```

Then open:

```bash
http://localhost:3000
```

## Production build

```bash
npm run build
npm run start
```

## Linting

```bash
npm run lint
```

## Notes

- The app is designed as an admin-facing attendance system rather than a generic public website.
- It is particularly useful for office environments, schools, co-working spaces, or internal attendance management.
- The workspace data persists in MongoDB, so it can be used as a real daily operations tool.

## License

This project does not currently declare a specific license in the repository metadata. If you plan to publish or share it publicly, you may want to add one.

## Author

Repository owner: `sovondas414-code`

## Future improvements

Possible enhancements for this project include:
- multi-user authentication for admins
- improved employee onboarding flow
- cloud deployment with Vercel or Docker
- stronger biometric data privacy management
- analytics dashboards for deeper reporting

## Summary

Attendly is a smart attendance and verification platform that combines dashboard reporting, employee management, and live face recognition to make attendance tracking simpler and more secure. It is a practical solution for businesses or organizations that want faster, more accurate attendance check-ins without paper-based or manual systems.
