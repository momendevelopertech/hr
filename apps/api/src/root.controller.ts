import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class RootController {
    @Get()
    getRoot(@Res() res: Response) {
        res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SPHINX HR API</title>
    <style>
      :root {
        --bg: #f3f6fb;
        --card: #ffffff;
        --text: #0f172a;
        --muted: #64748b;
        --brand: #1e3a5f;
        --brand-soft: #dbe7f5;
        --ok: #16a34a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        color: var(--text);
        font-family: "Plus Jakarta Sans", "Segoe UI", system-ui, -apple-system, sans-serif;
        background:
          radial-gradient(900px 500px at 10% 0%, rgba(30, 58, 95, 0.14), transparent),
          linear-gradient(145deg, #f8fafc, var(--bg));
      }
      .card {
        width: min(760px, 100%);
        background: var(--card);
        border-radius: 20px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
        overflow: hidden;
      }
      .header {
        padding: 26px 28px;
        background: linear-gradient(120deg, var(--brand), #223f65);
        color: #f8fafc;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .logo {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.16);
        display: grid;
        place-items: center;
      }
      .title { margin: 0; font-size: 1.2rem; }
      .subtitle { margin: 2px 0 0; opacity: 0.88; font-size: 0.92rem; }
      .body { padding: 28px; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #ecfdf3;
        color: #166534;
        border: 1px solid #86efac;
        font-size: 0.84rem;
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 700;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ok);
        box-shadow: 0 0 0 5px rgba(22, 163, 74, 0.2);
      }
      h1 { margin: 16px 0 10px; font-size: 1.6rem; }
      p { margin: 0 0 16px; color: var(--muted); }
      .grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .item {
        border: 1px solid rgba(30, 58, 95, 0.14);
        border-radius: 12px;
        padding: 12px;
        background: #fafcff;
      }
      .item b { display: block; margin-bottom: 6px; }
      code {
        background: var(--brand-soft);
        color: var(--brand);
        border-radius: 8px;
        padding: 2px 7px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }
      a {
        color: var(--brand);
        font-weight: 600;
        text-decoration: none;
      }
      .footer {
        margin-top: 18px;
        font-size: 0.85rem;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <header class="header">
        <div class="logo" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L4.8 5.2V11.4C4.8 16.4 7.8 20.9 12 22C16.2 20.9 19.2 16.4 19.2 11.4V5.2L12 2Z" fill="white" fill-opacity="0.95"/>
            <path d="M8.5 12.2L10.8 14.5L15.7 9.6" stroke="#1E3A5F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 class="title">SPHINX HR Platform</h2>
          <p class="subtitle">Backend Service Gateway</p>
        </div>
      </header>

      <section class="body">
        <span class="status"><span class="dot"></span>Service Online</span>
        <h1>Backend API is running successfully.</h1>
        <p>This endpoint confirms the server is healthy and protected by core security middleware.</p>

        <div class="grid">
          <div class="item">
            <b>API Base URL</b>
            <code>/api</code>
          </div>
          <div class="item">
            <b>Swagger (non-production)</b>
            <a href="/api/docs">/api/docs</a>
          </div>
          <div class="item">
            <b>Real-time Provider</b>
            <code>Pusher Channels</code>
          </div>
          <div class="item">
            <b>Security stack</b>
            <code>Helmet + CSRF + CORS + Validation</code>
          </div>
        </div>

        <p class="footer">If you are seeing this page, the backend deployment is up and responding correctly.</p>
      </section>
    </main>
  </body>
</html>`);
    }
}
