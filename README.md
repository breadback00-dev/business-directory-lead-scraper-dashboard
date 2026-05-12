# Business Directory Lead Scraper Dashboard

A portfolio-ready lead-generation system for turning business directory data into a sales workspace. It collects directory leads, enriches homepages for contact signals, deduplicates records, scores lead quality, and gives clients a dashboard for filtering, qualifying, and exporting prospects.

## Client Offer

> I build compliant business-directory lead scrapers that collect companies by category and location, enrich each record with website contact signals, remove duplicates, score lead quality, and deliver the results in a dashboard or Google Sheet your sales team can use immediately.

This demo is designed for B2B agencies, local SEO/web-design shops, vertical SaaS sellers, and founders who need repeatable prospect lists without risky source-bypass tactics.

## Outcome Examples

- `Manchester dentists` -> 5 OpenStreetMap leads scraped, 5 duplicates skipped on repeat run, homepage enrichment found emails, contact pages, social links, and booking signals.
- `Local SEO agency workflow` -> filter for businesses with websites, weak contact signals, or missing booking/contact paths, then export qualified leads to Google Sheets.
- `Outbound agency workflow` -> import a client CSV, deduplicate it against scraped leads, score the combined list, and export only high-fit prospects.

![Business Directory Lead Scraper dashboard](./dashboard-screenshot.png)

Demo video: add a 30-second Loom walkthrough link here.

## Why This Project Exists

Most scraper demos stop at a raw spreadsheet. This project demonstrates the next step: a client-facing dashboard where scraped records become usable sales intelligence.

The implementation also treats compliance as a product feature: the first production adapter uses OpenStreetMap/Overpass with attribution and conservative limits, rather than proxy rotation or bypass logic.

## Features

- Search leads by company, category, city, source, email, or enrichment signal
- Filter by business category and city
- Adjust the minimum lead score with a range control
- Review enrichment signals like email found, booking link, social links, outdated website, and CRM gaps
- Import real lead files from CSV
- Persist imported leads and status changes in Convex
- Review recent CSV import batches with created, duplicate, and invalid row counts
- Update lead status across New, Contacted, Qualified, and Rejected
- Export the filtered result set to CSV
- Track operational metrics including visible leads, qualified leads, average score, and emails found
- Responsive dashboard layout for desktop and smaller screens

## Tech Stack

- React
- TypeScript
- Vite
- Convex for the backend/database foundation
- PapaParse for CSV import
- Zod for import validation
- Lucide React icons
- CSS modules through standard app styles

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Configure Convex:

```bash
npm run convex:dev
```

The first Convex run will prompt you to log in, create or select a project, and write the deployment values used by the app.

Run the development server:

```bash
npm run dev
```

Or run Convex and Vite together:

```bash
npm run dev:full
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Demo Workflow

1. Open the dashboard.
2. Run the OpenStreetMap worker for a category and city, or import `sample-leads.csv`.
3. Run homepage enrichment to find emails, contact pages, social links, and booking/contact signals.
4. Search for a business type, city, email, or signal.
5. Filter by category or city and raise or lower the minimum score.
6. Change a lead status as the sales team qualifies the list.
7. Export the filtered leads to CSV or send them to a configured Google Sheets webhook.

## CSV Import Format

The importer accepts friendly column names and normalizes them internally.

Recommended headers:

```csv
Business Name,Category,City,Directory,Website,Email,Phone,Address,Score,Status,Signals,Source URL
```

Supported aliases include:

- `Business Name`, `Company`, or `Name`
- `Category`, `Industry`, or `Business Type`
- `City`, `Location`, `Town`, or `Market`
- `Directory`, `Source`, or `Lead Source`
- `Phone`, `Phone Number`, or `Telephone`
- `Source URL`, `Directory URL`, or `Listing URL`

`Signals` can be separated with semicolons, for example:

```csv
Email found; Booking link; Outdated website
```

If `Score` is missing, the app calculates a score from available email, phone, website, source URL, and enrichment signals.

## Import Pipeline

CSV files are parsed in the browser so users get immediate file handling, then normalized lead rows are sent to the Convex `leads.importMany` mutation. Convex validates required fields before saving, computes the canonical deduplication key from business name, city, email, and phone, and checks both the current import batch and existing `leads` records before inserting.

Each upload writes an `imports` record with:

- rows received
- leads created
- duplicates skipped
- invalid rows skipped

The dashboard shows the latest import batches above the lead metrics, and status edits on imported leads persist through Convex.

## Convex Data Model

The backend schema lives in `convex/schema.ts` and defines the foundation for the production pipeline:

- `leads`: normalized lead records, status, score, source references, and deduplication key
- `imports`: CSV import batches and import result counts
- `scrapeRuns`: scraper job metadata, progress counts, status, and logs
- `leadSources`: configured source directories or CSV sources

The dashboard reads leads and import history through Convex queries and writes CSV imports, status changes, and demo resets through Convex mutations.

## Scraper Worker Boundary

Scrape job metadata lives in Convex. Node workers do network and parsing work outside Convex, then report progress through Convex mutations.

Worker flow:

1. Call `scrapeRuns.create` with `targetCategory`, `targetLocation`, optional `maxPages`, and optional `leadSourceId`.
2. Call `scrapeRuns.markRunning` when the worker claims the run.
3. While crawling, call `scrapeRuns.updateProgress` with counts for pages checked, leads found, saved leads, duplicates, failures, and optional log lines.
4. Save scraped records through `scrapeRuns.recordLead`; it deduplicates against existing leads, stores new records with `sourceType: scrape`, attaches them to the run, and updates found/saved/duplicate counts.
5. If a lead already exists from another path, call `scrapeRuns.attachLead` to attach that existing lead ID to the run.
6. Call `scrapeRuns.complete` with final counts and summary, or `scrapeRuns.fail` with a failure summary.

The current dashboard includes a manual completed-run action so the run model, counts, logs, and recent-run display can be tested alongside source-specific scrapers.

## OpenStreetMap Directory Worker

The first production adapter is `scripts/osmDirectoryWorker.js`. It uses OpenStreetMap data through the public Overpass API, which is suitable for a conservative first source because OSM data is open under the ODbL and the public Overpass instance documents small-use expectations. The worker uses one bounded API request per run, waits before requests, retries transient failures, and caps results at 50 records.

Source rules:

- Source: [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- License and attribution: [OpenStreetMap copyright and license](https://www.openstreetmap.org/copyright)
- Public instance budget used here: one query per worker run, capped records, no proxy rotation, no bypass logic
- Attribution expectation: keep `OpenStreetMap` visible in the lead source/directory field and preserve the OSM listing URL on each lead

Supported categories:

- accountants
- cafes
- dentists
- pharmacies
- restaurants
- solicitors

Dry run without writing to Convex. `--country-code` defaults to `GB` so city names like Manchester resolve to the intended country:

```bash
npm run scrape:osm -- --category "dentists" --location "Manchester" --max-results 10 --dry-run
```

Write results to Convex:

```bash
CONVEX_URL="https://your-deployment.convex.cloud" npm run scrape:osm -- --category "dentists" --location "Manchester" --country-code "GB" --max-results 10 --write
```

`VITE_CONVEX_URL` also works if it is already exported in the shell. In write mode, the worker creates a scrape run, marks it running, writes leads through `scrapeRuns.recordLead`, then completes the run with saved and duplicate counts. Duplicate handling stays inside Convex so repeated worker runs do not create duplicate leads.

## Dashboard Operator Flow

The scraper can also be queued from the dashboard. The Scrape runs panel lets an operator choose:

- source: OpenStreetMap / Overpass
- category
- location
- country code
- maximum results

Click **Queue scrape run** to create a queued Convex `scrapeRuns` record. Then run the worker in queue-processing mode:

```bash
npm run scrape:osm -- --process-next --write
```

The worker claims the oldest queued run, marks it running, reads the configured category/location/result limit, saves or skips leads through Convex, and completes or fails the run with summary logs. The dashboard shows recent run status, limits, counts, summaries, and the latest log lines.

This keeps source rules visible to the operator while preserving the current conservative limits: public Overpass source, capped results, no proxy rotation, and no bypass logic.

## Homepage Enrichment Worker

The first enrichment worker is `scripts/homepageEnrichmentWorker.js`. It visits business homepages already stored on leads, extracts lightweight sales signals, and writes the results back through Convex. It intentionally checks only the homepage in this phase: no login walls, no bypassing, no aggressive crawling, and no contact-form submission.

Detected signals:

- email addresses on the homepage
- contact or enquiry page links
- social profile links
- booking, appointment, or contact-form language

Dry-run one website without reading or writing Convex:

```bash
npm run enrich:homepage -- --url "https://www.avaloncaredentalpractice.co.uk/" --dry-run
```

Dry-run the latest Convex leads that have websites:

```bash
CONVEX_URL="https://your-deployment.convex.cloud" npm run enrich:homepage -- --limit 10 --dry-run
```

Write enrichment results to Convex:

```bash
CONVEX_URL="https://your-deployment.convex.cloud" npm run enrich:homepage -- --limit 10 --write
```

In write mode, the worker updates the lead email when a lead does not already have one, merges enrichment signals into the existing signal list, and raises the score based on found contact signals. Failed homepage fetches are logged and do not stop the rest of the run.

## Google Sheets Export

The dashboard can send the current filtered lead list to a configured Google Sheets webhook while keeping the CSV export available. This is designed for a Google Apps Script web app, Zapier webhook, Make webhook, or any endpoint that accepts browser `POST` requests.

Configure a default webhook URL:

```bash
VITE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT/exec"
```

You can also paste a webhook URL into the dashboard field. The browser stores that URL locally for the next visit.

Payload shape:

```json
{
  "exportedAt": "2026-05-12T14:00:00.000Z",
  "source": "LeadVault dashboard",
  "filters": {
    "searchTerm": "",
    "category": "All categories",
    "city": "All cities",
    "minScore": 60
  },
  "count": 2,
  "leads": [
    {
      "businessName": "Avalon Dental Care",
      "category": "dentist",
      "city": "Manchester",
      "directory": "OpenStreetMap Overpass API",
      "website": "https://www.avaloncaredentalpractice.co.uk/",
      "email": "info@avalondentalcarepractice.co.uk",
      "phone": "+44 161 224 4345",
      "address": "281-283 Slade Lane, Manchester, M19 2HR",
      "score": 100,
      "status": "New",
      "signals": ["Email found on website", "Contact page found"],
      "sourceUrl": "https://www.openstreetmap.org/node/3121055823"
    }
  ]
}
```

The webhook must allow browser `POST` requests from the dashboard origin and return a 2xx response for successful exports. Failed responses are shown in the dashboard status message without changing lead data.

## Production Roadmap

This frontend is ready to connect to a real scraper pipeline. A production version would typically add:

- Job queue for scraping runs
- Backend API and database storage for leads and scrape history
- Deduplication across directories
- Website crawling for email, social, and contact-page enrichment
- Lead scoring rules configurable per client
- Google Sheets, Airtable, HubSpot, or Pipedrive export
- Authentication and saved client workspaces

## Project Status

This is a polished dashboard demo backed by Convex for lead storage, a working OpenStreetMap scraper adapter, homepage enrichment, and Google Sheets webhook export. The next production step is a dashboard-triggered operator flow for configuring and running scraper jobs without the command line.
