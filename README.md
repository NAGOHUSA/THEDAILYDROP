
# The Daily Drop

Automated generator for **season-aware daily essential oil recipes** used by the app **The Daily Drop**.

## What it does

- Produces one compact JSON recipe per day in `recipes/YYYY-MM-DD.json`.
- Automatically adapts to the **season** (Northern by default; invert with a secret).
- Tries API providers in order (OpenAI → Groq → DeepSeek) and **falls back to a local generator** so a file is always produced.

## Schedule

Runs daily at **09:00 UTC** (5:00 AM Eastern during Standard Time; 4:00 AM during Daylight Saving Time). You can also trigger manually via **Run workflow**.

## Setup

1. **Create secrets** (Settings → Secrets and variables → Actions):
   - `OPENAI_API_KEY` (optional)
   - `GROQ_API_KEY` (optional)
   - `DEEPSEEK_API_KEY` (optional)
   - `DAILY_DROP_HEMISPHERE` = `Northern` or `Southern` (optional; defaults to `Northern`)

2. (Optional) Test locally:
   ```bash
   npm i
   node generate-daily-drop.js
