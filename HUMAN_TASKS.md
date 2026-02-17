# Human Task List — Jinn MindMapper SaaS Launch
**For:** El7ias  
**From:** Jones  
**Updated:** 2026-02-17

Execute these tasks when prompted. I'll reference them by ID (e.g. "Ready for HT-01").
Add credentials to `.env` as you go — I'll have the template ready.

---

## 🔥 PRIORITY 1 — Unblocks Phases 0-2

### HT-01: Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click "Create a project" → Name it `jinn-mindmapper` (or your preference)
3. Enable Google Analytics (optional, recommended)
4. Once created, go to Project Settings → General → "Your apps" → Add Web App
5. Copy the Firebase config object (apiKey, authDomain, projectId, etc.)
6. Paste all values into `.env` (I'll have the template ready)

### HT-02: Enable Firebase Auth
1. In Firebase Console → Authentication → Sign-in method
2. Enable: **Google** (required)
3. Optional: Enable **Email/Password** and **GitHub**

### HT-03: Create Firestore Database
1. In Firebase Console → Firestore Database → Create database
2. Choose **production mode** (I'll deploy the security rules)
3. Select region: `us-central1` (matches Cloud Functions)

### HT-04: Enable Cloud Functions
1. You need Firebase Blaze plan (pay-as-you-go) for Cloud Functions
2. In Firebase Console → Functions → Get started
3. This may require adding a billing account

---

## ⚡ PRIORITY 2 — Unblocks Phase 3 (SaaS)

### HT-05: Create Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Complete account setup
3. Go to Developers → API Keys
4. Copy **Publishable key** and **Secret key**
5. Paste into `.env`

### HT-06: Pricing Decisions
Answer these questions (write answers below each):

**Free Tier:**
- Max projects: _____ (suggested: 3)
- Max agent runs/month: _____ (suggested: 5)
- Cloud sync: yes/no? (suggested: no, localStorage only)

**Pro Tier:**
- Monthly price: $_____ (suggested: $19-29/mo)
- Unlimited projects: yes/no?
- Unlimited agent runs: yes/no?
- Features to gate: _____

**Team Tier:**
- Monthly price: $_____ (suggested: $49-79/mo per seat)
- Shared workspaces: yes/no?
- Max team members: _____
- Additional features: _____

### HT-07: Design Direction
Answer these:

- Keep PCB / circuit board aesthetic? (yes/evolve/redesign)
- Brand colors beyond current cyan/magenta: _____
- Logo: Do you have one, or should I generate options?
- App name: Stay "Jinn MindMapper" or rebrand?
- Tagline: _____ (suggested: "Think it. Map it. Build it.")

---

## 🔮 PRIORITY 3 — Unblocks Phase 6 (Launch)

### HT-08: Domain Name
1. Choose and register a domain (e.g. jinnmindmapper.com, jinn.app, mindmapper.ai)
2. Share the domain name and DNS provider

### HT-09: Legal
You'll need:
- Terms of Service (I can draft, you review/approve)
- Privacy Policy (I can draft, you review/approve)
- Cookie consent banner (if targeting EU users)

### HT-10: Launch Go/No-Go
Final checklist before public launch (I'll prepare this when we're close)

---

*I'll start Phase 0 (showstopper fixes) immediately — no human tasks needed.*
