# Jewellery Catalogue: setup guide

A catalogue for your jewellery pieces. The page is hosted on **Vercel**, the data and photos are stored in **Supabase**, and the code lives on **GitHub**.

Plan about 45–60 minutes. No programming is needed. You'll only copy and paste.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The page: login, form, list |
| `app.js` | The program: saving, photos, search, PDF, backup, import |
| `config.js` | **The only file you edit:** your Supabase address and key |
| `supabase/setup.sql` | Script that sets up the database in Supabase |
| `vendor/` | Libraries the page needs (Supabase client and PDF creation). Upload them, don't change them |

---

## Step 1: Create the accounts

Create a free account with each of these services:

1. **GitHub**: https://github.com/signup
2. **Supabase**: https://supabase.com (you can sign up with your GitHub account)
3. **Vercel**: https://vercel.com/signup (choose "Continue with GitHub")

> **Vercel plan:** as far as we know, Vercel's free *Hobby* plan is for personal, non-commercial use only. A catalogue for your business may require the *Pro* plan. Please check the current terms at https://vercel.com/pricing.

---

## Step 2: Set up Supabase (database and photos)

> **Already done for you:** the project **schmuck-katalog** (Frankfurt) has been created, the tables, photo storage and security rules are set up (2a, 2b), and `config.js` already contains the project address and key (2d).
> **You only need to do step 2c** (your login and blocking sign-ups). The other steps stay here for reference, e.g. if you ever set up a second project.

### 2a. Create the project
1. In Supabase, click **New project**.
2. Name: e.g. `schmuck-katalog`.
3. Database password: choose a strong one and keep it safe (you rarely need it).
4. Region: pick an EU region, e.g. **Central EU (Frankfurt)**.
5. Click **Create new project** and wait 1–2 minutes until it's ready.

### 2b. Create the tables and photo storage
1. In the left menu, open **SQL Editor**.
2. Click **New query**.
3. Open `supabase/setup.sql` from this folder, copy **everything** and paste it into the editor.
4. Click **Run**. You should see "Success. No rows returned".

### 2c. Create your login and block strangers
1. In the left menu, open **Authentication**.
2. Go to **Sign In / Providers** (in some versions: *Providers* or *Settings*) and **turn off "Allow new users to sign up"**. Save.
   This makes sure nobody else can create an account on your catalogue.
3. Go to **Users** → **Add user** → **Create new user**.
4. Enter your e-mail and a password, and tick **Auto Confirm User**. Click **Create user**.

Repeat step 3–4 for anyone else who should have access. Everyone with a login can see and change all pieces.

### 2d. Copy your project address and key
In **Project Settings** (gear icon, bottom left):
- **Project URL**: under *Data API* (or *API*). It looks like `https://abcdefgh.supabase.co`.
- **Publishable key**: under *API Keys*. It starts with `sb_publishable_…`. Older projects call it the **anon public** key (starts with `eyJ…`).

**Do not use the "secret" or "service_role" key.** That one must never be put on a website.

Now open `config.js` in a text editor (e.g. Notepad or TextEdit) and replace the two placeholders:

```js
window.CATALOGUE_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseKey: "sb_publishable_xxxxxxxxxxxx"
};
```

Keep the quotation marks. Save the file.
(It's fine that this key is visible on the website: the security rules from step 2b only let signed-in users read or change anything.)

---

## Step 3: Put the code on GitHub

1. On GitHub, click **+** (top right) → **New repository**.
2. Name: e.g. `schmuck-katalog`. Choose **Private**. Click **Create repository**.
3. On the next page, click the link **"uploading an existing file"**.
4. Open this folder on your computer, select **all files and folders inside it** (`index.html`, `app.js`, `config.js`, `README.md`, the `vendor` folder and the `supabase` folder) and drag them into the browser window.
5. Wait until all files are listed, then click **Commit changes**.

Check that the repository shows `vendor` and `supabase` as folders. If they're missing, drag those folders in again.

---

## Step 4: Publish on Vercel

1. In Vercel, click **Add New…** → **Project**.
2. Under *Import Git Repository*, find `schmuck-katalog` and click **Import**.
   If you don't see it, click *Adjust GitHub App Permissions* and allow Vercel access to the repository.
3. Framework Preset: **Other**. Leave all build settings empty.
4. Click **Deploy**.

After about a minute you get an address like `https://schmuck-katalog.vercel.app`. Open it and sign in with the login from step 2c.

**Your own domain (optional):** in Vercel, open the project → **Settings** → **Domains** and follow the instructions.

---

## Step 5: Move your pieces from the claude.ai version

1. Open your current catalogue on claude.ai.
2. Below the list, click **Export everything (for moving)** and save the file (`katalog-export-….json`).
3. Open your new catalogue on Vercel and sign in.
4. Below the list, click **Import backup / export file** and choose that file. Confirm.

All pieces and photos are copied over. If something goes wrong, simply import the same file again: pieces that are already there are skipped.

---

## Optional: sign in with Google

The login page has a **Mit Google anmelden** button. To make it work:

1. **Google Cloud** (https://console.cloud.google.com):
   - Create a project (e.g. `schmuck-katalog`).
   - **APIs & Services → OAuth consent screen**: app name e.g. "Schmuckkatalog", your e-mail as support contact, user type **External**. Publish the app (otherwise only listed test users can sign in).
   - **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
   - Under **Authorized redirect URIs** add: `https://aiehswbjqmchwfuwrxoz.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client secret**.
2. **Supabase → Authentication → Sign In / Providers → Google**: turn it on, paste Client ID and Client secret, save.
3. **Supabase → Authentication → URL Configuration**:
   - **Site URL**: your Vercel address, e.g. `https://fanijansen.vercel.app`
   - **Redirect URLs**: add the same address (and any other address you use, e.g. a custom domain).

**Who can sign in with Google:** only people who already have a user in Supabase (Authentication → Users) with the **same e-mail address** as their Google account, as long as "Allow new users to sign up" stays **off**. Anyone else gets the message "Dieses Google-Konto hat keinen Zugang zum Katalog".

## Day-to-day use

- **Backups:** click **Save backup file** below the list every few weeks. The file contains all pieces and photos. Keep a copy somewhere safe (USB stick, cloud). It can be loaded again with **Import backup / export file**.
- **Supabase free plan:** Supabase has paused free projects after about a week without any use. Using the catalogue regularly prevents this. A paused project can be restarted from the Supabase dashboard (**Restore project**) and no data is lost.
- **Changing the code later:** edit a file on GitHub (open it → pencil icon → *Commit changes*). Vercel publishes the new version automatically within a minute.
- **Passwords:** a user can be given a new password in Supabase → Authentication → Users → (user) → *Send password recovery* or by deleting and re-creating the user.

## If something doesn't work

| What you see | What to check |
|---|---|
| "The catalogue isn't connected to Supabase yet" | `config.js` still has the placeholders, or the changes weren't uploaded to GitHub |
| "The Supabase library didn't load" | The `vendor` folder is missing on GitHub. Upload it again |
| "E-Mail oder Passwort ist falsch" | Check the user in Supabase → Authentication → Users. Was *Auto Confirm User* ticked? |
| "Your pieces couldn't be loaded" or "Could not save" with a message about a table | The script from step 2b wasn't run, or not completely. Run it again (it's safe) |
| Photos don't upload | Same as above: the photo storage is created by the script in step 2b |
