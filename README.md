# FUB Contact Enrichment & Social Listening Pipeline

An automated pipeline that connects to Follow Up Boss (FUB), discovers social media profiles for your contacts, analyzes their behavior using AI to generate DISC/OCEAN personality profiles, and monitors their social activity for real estate signals (traveling, in-area, property interest, life events).

## Features

1. **Social Profile Discovery**: Automatically finds LinkedIn, Facebook, Instagram, and Twitter profiles based on contact name, email, and location.
2. **Behavioral Profiling (DISC/OCEAN)**: Uses OpenAI to analyze social media bios, posts, and summaries to generate a comprehensive personality profile and real estate-specific communication guide.
3. **Social Listening**: Scans recent social posts for keywords and uses LLM analysis to detect:
   - ✈️ **Travel**: Contact is traveling or planning a trip.
   - 📍 **In Area**: Contact is visiting your specific market area.
   - 🏠 **Property Interest**: Contact is talking about real estate, moving, or house hunting.
   - 💍 **Life Events**: Marriage, new baby, job change, retirement.
   - 📉 **Market Sentiment**: Opinions on interest rates or the housing market.
4. **FUB Integration**: Pushes all enriched data back to Follow Up Boss as Custom Fields, Tags, and Notes.
5. **Automation**: Includes webhook handlers for real-time enrichment of new leads and cron endpoints for daily social listening.

## Project Structure

```
ai-simple/
├── api/                    # Serverless API endpoints (Webhooks & Cron)
│   ├── fub-webhook.js      # Listens for new/updated FUB contacts
│   ├── cron-enrich.js      # Batch enriches unenriched contacts
│   └── cron-listen.js      # Scans enriched contacts for new signals
├── scripts/                # CLI tools
│   └── enrich-contacts.js  # Main CLI entry point
├── src/                    # Core Pipeline Modules
│   ├── db/                 # Local JSON or Supabase storage
│   ├── enrichment/         # Social discovery and scraping
│   ├── fub/                # FUB API client and data mappers
│   ├── listening/          # Signal detection (keywords + LLM)
│   ├── profiling/          # DISC/OCEAN analysis via OpenAI
│   └── pipeline.js         # Main orchestrator
└── .env.example            # Environment configuration template
```

## Setup & Installation

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
   - `FUB_API_KEY`: Your Follow Up Boss API key (Settings → API).
   - `OPENAI_API_KEY`: Your OpenAI API key.
   - `TARGET_AREAS`: Comma-separated list of cities/areas to monitor for "In Area" signals (e.g., "Miami,Fort Lauderdale").

3. **Setup FUB Custom Fields:**
   Run the setup script to automatically create the necessary custom fields in Follow Up Boss:
   ```bash
   node scripts/enrich-contacts.js setup-fields
   ```

## Usage (CLI)

The pipeline includes a powerful CLI for manual runs and testing.

**Check Status:**
```bash
node scripts/enrich-contacts.js status
```

**Enrich a Single Contact:**
```bash
node scripts/enrich-contacts.js enrich-one --email "client@example.com"
# Or by ID:
node scripts/enrich-contacts.js enrich-one --id 12345
```

**Batch Enrich Contacts:**
```bash
# Enrich 50 contacts
node scripts/enrich-contacts.js enrich --limit 50

# Only enrich contacts that haven't been enriched yet
node scripts/enrich-contacts.js enrich --limit 50 --only-unenriched
```

**Run Social Listening Scan:**
```bash
# Scan enriched contacts for new signals in specific areas
node scripts/enrich-contacts.js listen --areas "Miami,Austin" --limit 100
```

## Automation (Webhooks & Cron)

This project is designed to be deployed to a serverless platform like Vercel or Heroku.

### 1. Real-time Enrichment (Webhooks)
In Follow Up Boss, go to **Admin → Integrations → Webhooks** and add a new webhook:
- **URL**: `https://your-domain.com/api/fub-webhook`
- **Events**: `People Created`, `People Updated`

When a new lead enters FUB, the webhook will trigger the pipeline to enrich them immediately.

### 2. Daily Social Listening (Cron)
If deploying to Vercel, the included `vercel.json` (you can create one) can trigger the cron endpoints:
- `/api/cron-enrich`: Runs daily to catch any missed contacts.
- `/api/cron-listen`: Runs 3x daily to scan for fresh social signals.

## How the Profiling Works

The system maps social data to two major psychological frameworks:

1. **DISC**: Dominance, Influence, Steadiness, Conscientiousness. Helps determine *how* to communicate (e.g., direct vs. story-driven, fast vs. methodical).
2. **OCEAN (Big Five)**: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism. Helps determine *what* they value (e.g., unique properties vs. traditional, high-risk vs. safe investments).

The LLM generates a specific "Communication Guide" tailored for real estate interactions based on these traits.

## License

MIT License
