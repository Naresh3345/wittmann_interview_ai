# Permanent Live Deployment

This project is ready for a permanent Flask deployment on Render.

## Why Cloudflare Tunnel Is Not Permanent

The `trycloudflare.com` tunnel is only for temporary testing. It depends on your laptop staying on and the tunnel process staying alive. A permanent deployment needs:

- A hosted web service for Flask.
- A managed PostgreSQL database.
- Persistent file storage for uploaded resumes and generated reports.
- HTTPS, so mobile camera and microphone permissions work.

## Recommended Host: Render

The included `render.yaml` creates:

- Flask web service: `wittmann-interview-ai`
- PostgreSQL database: `wittmann-interview-db`
- Persistent disk mounted at `/var/data`
- `REPORT_DIR=/var/data/reports` so reports and resumes survive restarts
- Gunicorn start command: `gunicorn app:app`

## Steps

1. Push this repository to GitHub.
2. Open Render and create a new Blueprint from the GitHub repository.
3. Render will read `render.yaml`.
4. After deployment, open the Render service URL.
5. Add email settings in Render Environment if you want test links to be sent by email:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-google-app-password
SMTP_FROM=your-email@gmail.com
```

## Important

- Do not upload `.env` to GitHub.
- Do not use `ENABLE_HTTPS=1` on Render. Render already provides HTTPS at the public URL.
- The free/temporary Cloudflare link will stop. Render gives a stable URL like:

```text
https://wittmann-interview-ai.onrender.com
```

You can later attach a custom domain in Render.
