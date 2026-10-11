# Schmuckkatalog – fanijansen fine jewellery

A catalogue for jewellery pieces. The page is hosted on **Vercel**, data and photos are stored in **Supabase**, and the code lives on **GitHub** (`bacherjo/schmuck-katalog`). Every change pushed to GitHub is published by Vercel automatically within about a minute.

**Current setup**

| What | Where |
|---|---|
| Website | Vercel project `schmuck-katalog` (address e.g. `https://fanijansen.vercel.app`, see *Settings → Domains*) |
| Database, photos, logins | Supabase project `schmuck-katalog`, region Frankfurt (`aiehswbjqmchwfuwrxoz`) |
| Code | GitHub repository `bacherjo/schmuck-katalog`, branch `main` |

---

## Features

### The form (one entry per piece)
- **Nr.**: an automatic 4-digit number, starting at **1000**. Assigned by the database when a piece is first saved. It can't be changed, and numbers of deleted pieces are not reused.
- **Name**, **Fotos** (up to four, shown as a 2×2 gallery; the first one is the Hauptfoto used in the list; large photos are reduced to 2000 px), **Beschreibung**
- *Separator line*
- **Steine** (hint: Preis, Karat, Größe, wann bei wem gekauft) + **Preis** (€)
- **Gold** (hint: Datum und Preis) + **Preis** (€)
- **Fasser** + **Preis** (€)
- **3D Druck** + **Preis** (€)
- **Extern (AZ/Material)** + **Preis** (€)  *(stored in the database column `willi` / `willi_preis`)*
- **Arbeitszeit** (hint: 1 Std = 120 Eur) + **Preis** (€)
- **Verkaufspreis**: calculated automatically as the sum of all Preis fields. Prices can be typed as `1.250,50`, `1250.50` or `12,5`. A Preis field that isn't a number turns red and the piece can't be saved until it's fixed.
- **Kommentar**
- **Stück speichern** button at the bottom right. Leaving a piece with unsaved changes asks whether to save or discard.

### List and search
- The list on the left shows photo, number, name, first line of the Beschreibung and Verkaufspreis, most recently changed first.
- **Search** looks through all fields, including number and prices.

### PDFs
- **PDF herunterladen**: two pages.
  - Page 1: name, photos (one photo large, two to four as a 2×2 gallery), Beschreibung, separator line
  - Page 2: Steine, Gold, Fasser, 3D Druck, Extern, Arbeitszeit (each with its Preis on the same line), Verkaufspreis bottom right, Kommentar
- **PDF Seite 1**: page 1 only (for customers).
- **Ganzen Katalog herunterladen (PDF)**: all pieces in one file.
- Every page has **fanijansen fine jewellery** at the top left and the piece number at the top right. File names start with the number, e.g. `1000 Ring 1.pdf`.

### Stück per E-Mail senden
- Creates a **secret link** for the piece and opens your e-mail program with a prepared message (the link is also copied, so it can be pasted into WhatsApp etc.).
- The link opens `stueck.html`, a public page **without login** that shows only: brand, number, name, photos (2×2 gallery), Beschreibung. Costs, prices, Steine and Kommentar are never sent to the recipient (the database only hands out these four fields).
- While a piece is shared, **"Per Link freigegeben · Freigabe aufheben"** appears under its number. Clicking it twice switches the link off; old links then show "nicht verfügbar". Sending again creates a new link.
- The piece must be saved first.

### Login
- **E-Mail + Passwort**, and optionally **Mit Google anmelden** (see below).
- Only people with a user in Supabase can sign in. Everyone who can sign in can see and change all pieces.

### Backup and import
- **Sicherungsdatei speichern** (below the list): downloads one `.json` file with all pieces and photos.
- **Sicherung / Export importieren**: loads such a file (or the export from the old claude.ai version). Pieces that are already in the catalogue are skipped, so importing the same file twice is safe. Imported pieces get new numbers.

### Brand name
"fanijansen fine jewellery" is fixed in the code: `BRAND` at the top of `app.js` (PDF header, e-mail text), and in `index.html` and `stueck.html` (page header). To change it, edit those places on GitHub.

---

## Files

| File | What it is |
|---|---|
| `index.html` | The catalogue: login, form, list (layout and styles) |
| `app.js` | The program: saving, photos, numbers, search, PDFs, e-mail links, backup, import |
| `stueck.html` | Public page behind the e-mail link (page 1 content only, no login) |
| `config.js` | Supabase address and publishable key (already filled in) |
| `supabase/setup.sql` | Database setup: tables, piece number, photo storage, security rules, share links |
| `vendor/` | Libraries (Supabase client, PDF creation). Don't change them |

---

## Setup status

| Step | Status |
|---|---|
| Supabase project, tables, photo storage, security rules, piece numbers, share links | ✅ done |
| `config.js` filled in | ✅ done |
| Code on GitHub | ✅ done |
| **Supabase: turn off sign-ups and create your login** (step A) | to do, if not done yet |
| **Vercel: import and deploy** (step B) | to do, if not done yet |
| Move pieces from the claude.ai version (step C) | to do, if needed |
| Google login (optional, step D) | optional |

### A. Supabase: logins and blocking strangers
1. Supabase → **Authentication → Sign In / Providers** (in some versions *Providers* or *Settings*): **turn off "Allow new users to sign up"**. Save. Without this, anyone who finds the site could register and see the catalogue.
2. **Authentication → Users → Add user → Create new user**: e-mail and password, tick **Auto Confirm User**.
3. Repeat step 2 for anyone else who should have access.

Optional: **Authentication → Settings → Leaked password protection** rejects passwords known from data breaches (may need a paid plan).

### B. Vercel: publish
1. https://vercel.com/new → sign in with **Continue with GitHub**.
2. Find `schmuck-katalog` → **Import**. If it's missing: *Adjust GitHub App Permissions* and allow access to the repository.
3. Framework Preset: **Other**, leave the rest empty → **Deploy**.
4. **Address:** project → **Settings → Domains** → *Edit* the `.vercel.app` address (e.g. `fanijansen.vercel.app`, if still free). A custom domain you own can be added there too.

> **Vercel plan:** as far as we know, Vercel's free *Hobby* plan is for personal, non-commercial use only. A business catalogue may need the *Pro* plan. Check https://vercel.com/pricing.

### C. Move pieces from the claude.ai version
1. In the old catalogue on claude.ai, click **Export everything (for moving)** below the list and save the file.
2. In the new catalogue, click **Sicherung / Export importieren** and choose that file. Confirm.

### D. Optional: sign in with Google
1. **Google Cloud** (https://console.cloud.google.com):
   - Create a project (e.g. `schmuck-katalog`).
   - **APIs & Services → OAuth consent screen**: app name e.g. "Schmuckkatalog", your e-mail as support contact, user type **External**. Publish the app (otherwise only listed test users can sign in).
   - **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
   - **Authorized redirect URIs**: `https://aiehswbjqmchwfuwrxoz.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client secret**.
2. **Supabase → Authentication → Sign In / Providers → Google**: turn on, paste both values, save.
3. **Supabase → Authentication → URL Configuration**: **Site URL** = your Vercel address (e.g. `https://fanijansen.vercel.app`), and add the same address under **Redirect URLs**.

Google sign-in only works for people who already have a Supabase user with the **same e-mail address** as their Google account (as long as sign-ups stay off). Anyone else sees "Dieses Google-Konto hat keinen Zugang zum Katalog".

---

## Day-to-day use

- **Backups:** click **Sicherungsdatei speichern** every few weeks and keep the file somewhere safe (USB stick, cloud).
- **Supabase free plan:** Supabase has paused free projects after about a week without use. Using the catalogue regularly prevents this. A paused project can be restarted in the Supabase dashboard (**Restore project**); no data is lost.
- **Changing the code:** edit a file on GitHub (open it → pencil icon → *Commit changes*). Vercel publishes it within a minute.
- **Passwords:** in Supabase → Authentication → Users, send a password recovery e-mail, or delete and re-create the user.

## If something doesn't work

| What you see | What to check |
|---|---|
| "Der Katalog ist noch nicht mit Supabase verbunden" | `config.js` is missing or still has placeholders |
| "Die Supabase-Bibliothek wurde nicht geladen" | The `vendor` folder is missing on GitHub |
| "E-Mail oder Passwort ist falsch" | Check the user in Supabase → Authentication → Users. Was *Auto Confirm User* ticked? |
| "Die Google-Anmeldung ist in Supabase noch nicht eingeschaltet" | Step D2 |
| After Google sign-in you land on the wrong address | Step D3 (Site URL / Redirect URLs) |
| "Die Stücke konnten nicht geladen werden" / "Speichern fehlgeschlagen" mentioning a table or column | The database isn't fully set up: run `supabase/setup.sql` in Supabase → SQL Editor (safe to run again) |
| E-mail button: nothing opens | No e-mail program is set up on this device. The link is still copied; paste it into any e-mail |
| Link page says "nicht verfügbar" | The share was switched off ("Freigabe aufheben") or the link is incomplete |

## Setting up from scratch (reference)

Only needed for a second, separate catalogue:
1. Create a Supabase project (EU region), open **SQL Editor → New query**, paste all of `supabase/setup.sql`, **Run**.
2. In **Project Settings**, copy the **Project URL** (*Data API*) and the **publishable key** (*API Keys*, `sb_publishable_…`) into `config.js`. Never use the *secret* / *service_role* key.
3. Put the files on GitHub, then follow steps A and B.
