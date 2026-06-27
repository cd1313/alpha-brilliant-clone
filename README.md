# Asymptote

An interactive precalculus learning app for high school students. Students work through structured lessons using draggable SVG simulators, complete adaptive review sessions, take section unit tests, and track their mastery over time. Built in the style of Brilliant.org: learning by doing, not watching.

## Active Link: https://alpha-brilliant-clone.web.app/

## Features

- **Interactive lessons** — Lessons grouped by units, each broken into explore, challenge, reflection, and mastery steps driven by live SVG simulators
- **Smart Review** — adaptive 6-item review sessions weighted toward weak skills using an exponential moving average of miss rates
- **Practice sets** — 5 challenge problems per completed lesson, randomly generated each time
- **Unit tests** — 10-question section assessments, required to pass before moving to the next unit
- **Weakness Map** — radar chart and per-component breakdown of mastery across all
- **Daily review gate** — must complete a review or practice session each day before starting a new lesson
- **Streak tracking** — daily activity streaks
- **AI tutor (optional)** — post-session performance summaries, scoped follow-up chat, tailored hints, AI-generated reflection questions, and a weakness narrative with study plan, all backed by OpenAI `gpt-4o-mini` via a Cloud Function. however, every AI feature has a valid deterministic fallback



## Tech Stack


| Layer     | Technology                                                  |
| --------- | ----------------------------------------------------------- |
| Frontend  | React 19, React Router 7, TypeScript ~6, Vite 8             |
| Styling   | Custom CSS (no framework)                                   |
| Auth & DB | Firebase Auth, Cloud Firestore                              |
| Backend   | Firebase Cloud Functions v1, Node.js 22                     |
| AI        | OpenAI API (`gpt-4o-mini`) via a single `aiAssist` callable |
| Hosting   | Firebase Hosting (Classic)                                  |




## Project Structure

```
├── src/
│   ├── pages/              # Route-level views
│   ├── components/
│   │   ├── lesson/         # LessonEngine and per-step views
│   │   ├── review/         # ReviewSession, PostSessionTutor
│   │   ├── insights/       # WeaknessRadar, ComponentBreakdown
│   │   └── */              # SVG simulators (cone, parabola, circle, etc.)
│   ├── hooks/              # useAuth, useProgress
│   ├── lib/
│   │   ├── ai/             # AI client wrappers (all return null on failure)
│   │   ├── *Geometry.ts    # Per-simulator math
│   │   ├── learnerProfile.ts
│   │   ├── reviewSkills.ts
│   │   └── reviewGenerator.ts
│   ├── content/
│   │   ├── course.json     # Course structure (sections, lessons, unlock order)
│   │   └── lessons/        # Per-lesson step definitions (9 JSON files)
│   └── types/              # lesson.ts, progress.ts
├── functions/
│   └── src/index.ts        # aiAssist Cloud Function (OpenAI)
├── firebase.json
├── firestore.rules
└── .env.example
```



## Getting Started



### Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools` or use `npx firebase-tools`)
- A Firebase project on the Blaze plan (required for Cloud Functions with secrets)



### Local Setup

```bash
npm install
cp .env.example .env.local
# Fill in your Firebase web config values in .env.local
npm run dev
```



### Running with Firebase Emulators

Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local`, then in two terminals:

```bash
# Terminal 1
npm run firebase:emulators

# Terminal 2
npm run dev
```

Emulator ports: Auth `9099`, Firestore `8080`, Functions `5001`, Hosting `5000`, UI `4000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.


| Variable                            | Description                                                |
| ----------------------------------- | ---------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase web API key                                       |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                                       |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID                                        |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Firebase storage bucket                                    |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID                               |
| `VITE_FIREBASE_APP_ID`              | Firebase app ID                                            |
| `VITE_USE_FIREBASE_EMULATORS`       | Set to `"true"` to use local emulators                     |
| `VITE_ENABLE_AI_TUTOR`              | Set to `"true"` to enable AI tutor and Insights AI overlay |




## AI Setup (Optional)

AI features require the `aiAssist` Cloud Function to be deployed and an OpenAI API key stored in Firebase Secret Manager:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions
```

Then set `VITE_ENABLE_AI_TUTOR=true` in your environment. The app works fully without AI — every feature has a deterministic fallback.

## Building and Deploying

```bash
# Production build
npm run build

# Deploy everything (rules + functions + hosting)
npm run firebase:deploy

# Deploy hosting only (runs build first)
npm run firebase:deploy:hosting

# Deploy Firestore rules only
npm run firebase:deploy:rules
```



## Course Content (So Far)

**Unit 1 — Conic Sections**

1. Introduction to Conics
2. Parabolas
3. Circles
4. Ellipses
5. Hyperbolas

→ Unit Test (pass to unlock Unit 2)

**Unit 2 — Trigonometric Functions**

1. Angles & Radians
2. The Unit Circle
3. Sine & Cosine Graphs
4. Tangent & Reciprocal Functions



## Data Model

Progress is stored in Firestore under `users/{uid}`:

- Top-level document — streak, completed lessons, last review date, passed unit tests
- `lessonProgress/{lessonId}` — current step index and exploration metadata per lesson
- `skillStats/{skillId}` — attempts, misses, weak components, and EMA miss rate per skill (12 skills across 6 topics)

