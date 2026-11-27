# TalentIQ — Hiring with Intelligence. Growing with Opportunity.

TalentIQ is a single-root Node.js, Express, SQLite, React, Vite, and TypeScript AI recruitment ecosystem built with a calm pastel-light interface and dual portals for **Recruiters** and **Candidates**.

## Key Features
- **Explainable AI Matching & TalentIQ Match DNA**: Deterministic weighted scoring across Skills, Experience, Education, and Keywords with an auditable **Evidence Ledger** showing confirmed, inferred, and missing resume excerpts.
- **Blind Screening Mode ("Blind First, Reveal Later")**: Server-side redaction of names, contact info, locations, employer/institution identifiers, and gendered pronouns, paired with an audited identity reveal log.
- **Resume Integrity Radar**: Rule-based detection of overlapping employment dates, duration mismatches, missing details, and claims requiring manual verification.
- **Alternative Job Finder ("Opportunity Beyond Rejection")**: Transferable-skill recommendations across genuine active database openings with **Skill-to-Opportunity Bridge** project suggestions.
- **Dual Portals**:
  - **Recruiter Portal**: Dashboard, Job Management (with INR packages & Remote/Hybrid/On-site modes), Candidate Comparison (up to 3), Blind Screening, Hiring Pipeline with audit history, Analytics & CSV Reports, AI Assistant (with deterministic local fallback), and Razorpay UPI Billing.
  - **Candidate Portal**: Dashboard, Job Discovery & Saved Jobs, Application Tracker, Resume Upload/Replacement & Profile Editor, Resume Integrity Radar, Skill Gap Analyzer, Career Growth Roadmap, and Interview Prep.
- **Payment Security (Razorpay Standard Checkout)**: Server-side plan pricing in INR, Razorpay order creation, HMAC-SHA256 signature verification (`crypto.timingSafeEqual`), gateway payment status verification, and raw-body HMAC webhook verification with idempotency.

## Quick Start (Single Project Root)

Requires **Node.js >= 22.13.0** (uses built-in `node:sqlite`).

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Production Build & Start
```bash
npm run build
npm start
```

### Run Tests
```bash
npm test
```

## Switching Razorpay from Test Mode to Live Mode
1. Copy `.env.example` to `.env`.
2. In **Test Mode**, set `RAZORPAY_KEY_ID=rzp_test_...`, `RAZORPAY_KEY_SECRET=...`, and `RAZORPAY_WEBHOOK_SECRET=...` from Razorpay Dashboard → Settings → API Keys & Webhooks.
3. For **Live Mode**, replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with your `rzp_live_...` production credentials and update `RAZORPAY_WEBHOOK_SECRET` to your live webhook secret. Ensure HTTPS is enabled and `APP_BASE_URL` points to your production domain.
4. If credentials are omitted, checkout displays a clear configuration notice and never simulates fake payment success or activates subscriptions.
