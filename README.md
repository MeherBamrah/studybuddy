# ✦ StudyBuddy — AI Study Assistant

A **AI study app** built with Next.js and the Gemini API. Upload PDFs, images, or handwritten notes and have a full multi-turn conversation with a Gemini-powered agent — right from your browser.

Built for **GDG hands-on sessions** as a "Build with Gemini" demo.

---

## ✨ Features

- 📄 **Upload anything** — PDFs, images, handwritten notes, diagrams
- 💬 **Multi-turn chat** — full conversation memory across the session
- ⚡ **Streaming responses** — token-by-token like ChatGPT
- 🎭 **4 learning personas** — Study Buddy, Socratic, Exam Coach, ELI5
- 🚀 **One-click Vercel deploy** — no backend needed, all serverless

---

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI | Gemini 2.0 Flash via @google/genai |
| Deployment | Vercel (Edge Runtime) |
| File handling | react-dropzone |

---

## 🚀 Deploy to Vercel (3 steps)

### Step 1 — Get your free Gemini API key
Go to aistudio.google.com → Sign in → Get API Key → Create → Copy

### Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "initial: gemini study buddy"
git remote add origin https://github.com/YOUR_USERNAME/gemini-study-buddy.git
git push -u origin main
```

### Step 3 — Deploy on Vercel

1. Go to vercel.com → New Project → Import your GitHub repo
2. Add environment variable: GEMINI_API_KEY = your key
3. Hit Deploy — done!

Or via CLI:
```bash
npm i -g vercel
vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

---

## 💻 Run locally

```bash
git clone https://github.com/YOUR_USERNAME/gemini-study-buddy.git
cd gemini-study-buddy
npm install
cp .env.example .env.local
# Edit .env.local: GEMINI_API_KEY=your_key_here
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project structure

```
gemini-study-buddy/
├── app/
│   ├── api/chat/route.ts    ← Streaming Gemini API route (Edge)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── StudyBuddy.tsx       ← Full chat UI
├── .env.example
├── next.config.js
└── package.json
```

---

## 🔑 Environment variables

| Variable | Required | Description |
|---|---|---|
| GEMINI_API_KEY | Yes | Your key from aistudio.google.com |

In Vercel: Project Settings → Environment Variables → Add GEMINI_API_KEY

---

*Built at a GDG hands-on session · Powered by Gemini API*
