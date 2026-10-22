# AutoFix testing evidence

This directory contains the user-facing visual walkthrough and browser evidence produced by the full-stack CI run.

The browser suite drives the real Next.js UI against the real FastAPI service and a disposable PostgreSQL database.

- Frontend: Next.js / React / TypeScript
- Backend: FastAPI / SQLAlchemy async
- Database: PostgreSQL
- Browser verification: Playwright / Chromium

The important boundary is **UI -> API -> backend logic/auth -> PostgreSQL -> API response -> UI**.

See [VISUAL-TEST-WALKTHROUGH.md](./VISUAL-TEST-WALKTHROUGH.md) after the first successful browser run publishes the screenshots.
