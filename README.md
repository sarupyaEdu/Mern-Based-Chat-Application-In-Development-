# Next Chat App

A real-time chat application built with Next.js, Socket.IO, MongoDB, email OTP flows, passkeys, TOTP 2FA, contacts, GIFs, attachments, and profile/security management.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill in your real values:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

## Environment Variables

Set these in `.env` locally and in your hosting platform for production:

- `MONGODB_URI`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `ALLOWED_SOCKET_ORIGINS`
- `NEXT_PUBLIC_GIPHY_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

## Deployment Recommendation

This app uses a custom Node server in [server.js](./server.js) and Socket.IO for realtime messaging. Because of that, Railway or Render is a better fit than a typical serverless-only Next.js deployment.

Railway is the recommended path for this project.

### Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add all environment variables from `.env.example`.
4. Make sure:
   - `NEXTAUTH_URL` points to your public app URL
   - `NEXT_PUBLIC_SOCKET_URL` points to the same public app URL
   - `ALLOWED_SOCKET_ORIGINS` includes your public app URL
5. Deploy.

The app already reads `process.env.PORT`, so it is ready for Railway-style hosting.

## GitHub Upload

If Git is not initialized yet:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Notes

- Do not commit `.env`.
- Rotate any secrets that were ever exposed during development.
- Passkeys require `https://` in production, or `localhost` in local development.
"# Mern-Based-Chat-Application-In-Development-" 
