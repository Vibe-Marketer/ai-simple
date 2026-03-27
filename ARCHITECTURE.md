# FUB Contact Enrichment & Social Listening Pipeline

## Overview
This system is designed to automatically enrich Follow Up Boss (FUB) contacts with social media data, generate psychological profiles (DISC/OCEAN), and monitor their social activity for real estate and travel signals.

## Core Components

### 1. FUB Integration Module (`src/fub/`)
- **Contact Sync**: Pulls new and existing contacts from FUB via the `/v1/people` endpoint.
- **Data Push**: Pushes enriched data back to FUB.
  - **Custom Fields**: Stores DISC/OCEAN scores, primary social links, and current location.
  - **Notes**: Adds detailed communication coaching and social listening alerts via the `/v1/notes` endpoint.
- **Webhooks**: Listens for new lead creation in FUB to trigger real-time enrichment.

### 2. Social Enrichment Engine (`src/enrichment/`)
- **Profile Discovery**: Uses contact details (email, phone, name) to discover social media profiles (LinkedIn, Facebook, Instagram, X).
- **Data Extraction**: Scrapes public bio, recent posts, and professional history.
- **Data Storage**: Caches raw social data in Supabase to avoid redundant scraping and API costs.

### 3. Psychological Profiling Engine (`src/profiling/`)
- **LLM Analysis**: Utilizes OpenAI (GPT-4) to analyze the extracted social data.
- **DISC/OCEAN Generation**: Maps behavioral traits to the DISC (Dominance, Influence, Steadiness, Conscientiousness) and OCEAN (Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism) frameworks.
- **Communication Coaching**: Generates actionable advice on how to communicate with the contact (e.g., "Be direct and focus on ROI" vs. "Build rapport and focus on community").

### 4. Social Listening Module (`src/listening/`)
- **Signal Detection**: Periodically scans recent social posts for specific keywords and context (e.g., "traveling to", "looking for a house", "moving").
- **Alerting**: When a signal is detected, it logs an alert in Supabase and pushes a high-priority Note to FUB, optionally tagging the assigned agent.

### 5. Orchestration & Scheduling (`api/`)
- **Serverless Functions**: Exposes endpoints for webhooks and manual triggers.
- **Cron Jobs**: Scheduled tasks to run batch enrichment for older contacts and periodic social listening for high-value contacts.

## Project Structure
```text
ai-simple/
├── api/
│   ├── fub-webhook.js        # Endpoint to receive FUB lead events
│   ├── cron-enrich.js        # Scheduled batch enrichment
│   └── cron-listen.js        # Scheduled social listening
├── src/
│   ├── fub/
│   │   ├── client.js         # FUB API wrapper
│   │   └── mapper.js         # Data transformation for FUB
│   ├── enrichment/
│   │   ├── discover.js       # Find social profiles
│   │   └── scraper.js        # Extract social data
│   ├── profiling/
│   │   ├── analyzer.js       # LLM prompt and parsing
│   │   └── models.js         # DISC/OCEAN schemas
│   ├── listening/
│   │   └── detector.js       # Signal detection logic
│   └── db/
│       └── supabase.js       # Database client
├── supabase/
│   └── migrations/           # DB schemas for caching and logs
└── ARCHITECTURE.md           # This document
```

## Data Flow
1. **Trigger**: A new lead enters FUB, sending a webhook to `api/fub-webhook.js`, OR `api/cron-enrich.js` fetches a batch of unenriched contacts.
2. **Enrichment**: `src/enrichment/` finds social profiles and extracts recent activity.
3. **Profiling**: `src/profiling/` sends the activity to OpenAI to generate DISC/OCEAN scores and communication tips.
4. **Update**: `src/fub/` creates custom fields in FUB for the scores and adds a Note with the communication guide.
5. **Listening**: `api/cron-listen.js` runs daily/weekly, fetching recent posts for enriched contacts. If `src/listening/` detects a signal (e.g., travel), it pushes an alert Note to FUB.
