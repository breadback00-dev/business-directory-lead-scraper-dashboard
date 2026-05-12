# Business Directory Lead Scraper Dashboard

A Level 6 lead-generation dashboard that shows how scraped business directory data can become a practical sales workspace. The app lets a client review enriched leads, filter by market, adjust quality thresholds, update outreach status, and export the current view as a CSV.

![Business Directory Lead Scraper dashboard](./dashboard-screenshot.png)

## Why This Project Exists

Most scraper demos stop at a raw spreadsheet. This project demonstrates the next step: a client-facing dashboard where scraped records become usable sales intelligence.

It is designed as a portfolio-ready Upwork demo for a **Business Directory Lead Scraper** service.

## Features

- Search leads by company, category, city, source, email, or enrichment signal
- Filter by business category and city
- Adjust the minimum lead score with a range control
- Review enrichment signals like email found, booking link, social links, outdated website, and CRM gaps
- Update lead status across New, Contacted, Qualified, and Rejected
- Export the filtered result set to CSV
- Track operational metrics including visible leads, qualified leads, average score, and emails found
- Responsive dashboard layout for desktop and smaller screens

## Tech Stack

- React
- TypeScript
- Vite
- Lucide React icons
- CSS modules through standard app styles

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
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
2. Search for a business type, city, email, or signal.
3. Filter by category or city.
4. Raise or lower the minimum score.
5. Change a lead status.
6. Export the filtered leads to CSV.

## Production Roadmap

This frontend is ready to connect to a real scraper pipeline. A production version would typically add:

- Directory-specific scraper adapters
- Job queue for scraping runs
- Database storage for leads and scrape history
- Deduplication across directories
- Website crawling for email, social, and contact-page enrichment
- Lead scoring rules configurable per client
- Google Sheets, Airtable, HubSpot, or Pipedrive export
- Authentication and saved client workspaces

## Client Pitch

> I can build a lead scraper that collects businesses from directories, enriches each lead by visiting their website, extracts emails and contact signals, removes duplicates, scores lead quality, and gives you a dashboard where you can filter, qualify, and export the best leads.

## Project Status

This is a polished frontend demo with mock data. It is structured to demonstrate the product experience before connecting a real scraping backend.
