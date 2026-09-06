# L-Tech Blog API

Node.js and MongoDB backend for the Blogs page. Blog posts are stored in MongoDB and uploaded images are stored in GridFS.

## Setup

1. Install Node.js 18 or newer.
2. Create a MongoDB database, locally or in Atlas.
3. Copy `.env.example` to `.env` and set `MONGODB_URI`.
4. Install dependencies and start the API:

```powershell
cd server
npm install
npm start
```

The API runs on `http://localhost:3000` by default.

## Endpoints

- `GET /api/health`
- `GET /api/blogs`
- `POST /api/blogs` with multipart fields `author`, `title`, `body`, and optional `image`
- `GET /api/images/:id`
- `POST /api/blogs/:id/like` with JSON `{ "delta": 1 }` or `{ "delta": -1 }`
- `POST /api/blogs/:id/comments` with JSON `{ "author": "...", "text": "..." }`
- `POST /api/blogs/:id/share`

The API serves the static site from the project root, so open `http://localhost:3000/blogs.html` after starting the server. This keeps the Blogs page and API on the same origin.

## Deploying to Vercel

Set the Vercel project root directory to `server/`. Vercel will use `vercel.json` to route requests to the Express API. Add these Vercel environment variables for Production, Preview, and Development as needed:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `CORS_ORIGIN`

## PWA

Open the site through `http://localhost:3000/home.html` or a deployed HTTPS URL. The service worker requires HTTPS in production and caches the main app shell for offline navigation. API requests remain online-only so blog data is not cached as stale content.
