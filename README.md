# 👁️ KalevaLens

> **AI-powered local news that adapts to the reader — without losing the local context.**

KalevaLens is a hackathon prototype for discovering news from Oulu, Finland, and beyond. It combines live RSS ingestion, AI-assisted editorial workflows, multilingual summaries, personalized feeds, community reporting, and short audio briefings in one mobile-first experience.

## ✨ What it does

- Builds a personalized news feed from local, Finnish, European, and international sources
- Adapts article language, length, and context to each reader
- Uses a human-in-the-loop moderation board for community submissions
- Generates multilingual AI summaries and short audio narrations
- Supports comments, subscriptions, reactions, onboarding, and community feeds
- Tracks source permissions and attribution throughout the editorial pipeline

## 🧰 Tech stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| AI workflows | Google Gemini, LangGraph, Zod |
| Database | Neon serverless Postgres |
| News ingestion | `rss-parser` |
| Audio | Gemini TTS, FFmpeg |
| Tests | Vitest |

## 🚀 Run locally

### Prerequisites

- [Node.js](https://nodejs.org/) **20.9 or newer**
- npm (included with Node.js)
- A [Neon](https://neon.tech/) Postgres database
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- Git

FFmpeg does not need to be installed separately: the project includes `ffmpeg-static`.

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd KalevaLens/kaleva-news
```

If you already have the repository, start from its root and run `cd kaleva-news`.

### 2. Install dependencies

Use the committed lockfile for a reproducible install:

```bash
npm ci
```

### 3. Configure the environment

Copy the safe template:

```bash
cp .env.example .env.local
```

Open `.env.local` and replace these two required placeholders:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
GEMINI_API_KEY=your_google_gemini_api_key
```

`DATABASE_URL` must point to a writable Postgres database. The application creates the required tables automatically on first use. The remaining values in `.env.example` are ready-to-use local defaults and can be adjusted if needed.

> [!IMPORTANT]
> Never commit `.env.local`, database credentials, API keys, or cron secrets. Environment files are ignored by Git; only `.env.example` is intended to be committed.

### 4. Start the development server

```bash
npm run dev
```

Open **http://127.0.0.1:3000**.

### 5. Optional: ingest live news

With the dev server running, trigger RSS ingestion in another terminal:

```bash
curl -X POST \
  -H "Authorization: Bearer replace-with-your-cron-secret" \
  http://127.0.0.1:3000/api/cron/ingest-rss
```

The app also contains mock content, so the interface can be explored before running ingestion. Live AI generation, persistence, and audio production require valid Gemini and Neon credentials.

## 🔑 Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon/Postgres connection string |
| `GEMINI_API_KEY` | Yes | Gemini generation and text-to-speech |
| `CRON_SECRET` | Recommended | Protects the RSS ingestion endpoint |
| `MEDIA_JOB_SECRET` | Recommended | Protects the media worker endpoint |
| `NEWS_RSS_FEEDS` | No | Comma-separated custom RSS feed URLs |
| `GEMINI_MODEL_DEFAULT` | No | Default text model |
| `GEMINI_MODEL_NARRATION` | No | Narration-writing model |
| `GEMINI_MODEL_AUDIO` | No | Text-to-speech model |
| `GEMINI_MODEL_MEDIA_QA` | No | Media quality-check model |
| `MEDIA_AUDIO_ENABLED` | No | Enables audio generation |
| `MEDIA_AUTO_PROCESS_ON_START` | No | Starts the local background media worker |
| `MEDIA_LANGUAGES` | No | Comma-separated audio languages |
| `MEDIA_STORAGE_ROOT` | No | Local directory for generated media |
| `MEDIA_PUBLIC_BASE_URL` | No | Public URL prefix for generated media |

See [`kaleva-news/.env.example`](kaleva-news/.env.example) for every supported setting and documented defaults.

## ✅ Verify the setup

From `kaleva-news/`, run:

```bash
npm test
npm run lint
npm run build
```

To test the production build locally:

```bash
npm run start
```

Then open **http://127.0.0.1:3000**.

## 🎤 Demo flow

1. Create an account and complete the reader-preference onboarding.
2. Explore **My News** and swipe stories to tune the feed.
3. Change language, reading level, summary length, and audio preferences.
4. Open a story's comments or play its generated audio briefing.
5. Submit a community story, then review the human-in-the-loop workflow at `/moderator/kanban`.

## 📁 Project structure

```text
KalevaLens/
├── README.md                 # You are here
└── kaleva-news/
    ├── app/                     # Next.js routes, pages, actions, and APIs
    ├── components/              # Reader and moderator UI
    ├── data/                    # Demo news content
    ├── lib/                     # AI, database, RSS, preferences, and media
    ├── public/                  # Static and generated media
    ├── .env.example             # Safe configuration template
    └── package.json             # Commands and dependencies
```

## 📦 Submission checklist

- [ ] Repository is public or shared with the organizers
- [ ] A fresh clone works with the instructions above
- [ ] No real secrets or credentials are committed
- [ ] Demo video and slide links open without requesting access
- [ ] Links do not expire before judging
- [ ] Project name and description are complete on the submission portal
- [ ] Production/demo deployment is reachable, if provided

## 🤝 Team

Built by **ROI Searchers** for the JunctionX Hackathon.
