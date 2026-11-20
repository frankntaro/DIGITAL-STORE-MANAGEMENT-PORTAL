# Deployment & Google Discoverability Guide
## KAMPANGO PHONES AND ELECTRONICS — Digital Store Management Portal

This project is pre-configured for **single-origin production hosting** (React PWA + PHP 8.3 REST API + MySQL + SEO `robots.txt` & `sitemap.xml` served from one HTTPS URL).

---

## Step 1: Create Free MySQL Database on TiDB Cloud (No Credit Card, 5 GB Free)

1. Go to [https://tidbcloud.com/](https://tidbcloud.com/) and sign up free (email or GitHub, no card required).
2. Click **Create Cluster** → choose **Starter (Free)** → pick the closest region (e.g., Frankfurt / Singapore) → click **Create**.
3. Once active, open your cluster → click **SQL Editor** (or **Databases**) and run:
   ```sql
   CREATE DATABASE IF NOT EXISTS kampango_esms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Click **Connect** → **Generate Password** → copy and save:
   - `DB_HOST` (e.g. `gateway01.eu-central-1.prod.aws.tidbcloud.com`)
   - `DB_PORT` (`4000`)
   - `DB_DATABASE` (`kampango_esms`)
   - `DB_USERNAME` (e.g. `2abcXYZ.root`)
   - `DB_PASSWORD` (the generated password)
   - `DB_SSL` (`true`)

---

## Step 2: Deploy Free on Render (or Koyeb) from GitHub

### Option A: Render (`https://render.com`)
1. Sign in with GitHub (`frankntaro`).
2. Click **New +** → **Web Service** → select **`frankntaro/DIGITAL-STORE-MANAGEMENT-PORTAL`**.
3. Set:
   - **Runtime:** `Docker` (auto-detected from `Dockerfile`)
   - **Instance Type:** `Free`
   - **Health Check Path:** `/api/health`
4. Add **Environment Variables**:
   - `PORT` = `10000`
   - `DB_HOST` = *(from TiDB Cloud)*
   - `DB_PORT` = `4000`
   - `DB_DATABASE` = `kampango_esms`
   - `DB_USERNAME` = *(from TiDB Cloud)*
   - `DB_PASSWORD` = *(from TiDB Cloud)*
   - `DB_SSL` = `true`
5. Click **Create Web Service**. On first request, the backend automatically creates all 29 tables and seeds your KAMPANGO catalog & Admin account (`admin` / `admin123` — change immediately in **Admin Account Settings**!).

### Option B: Koyeb (`https://app.koyeb.com`) — No Card Gate
1. Sign in with GitHub (`frankntaro`) → **Create Service** → **Web Service** → **GitHub** → select `frankntaro/DIGITAL-STORE-MANAGEMENT-PORTAL`.
2. **Builder:** `Dockerfile` · **Port:** `8000` · **Health check:** `/api/health`.
3. Add the exact same `DB_HOST`, `DB_PORT=4000`, `DB_DATABASE=kampango_esms`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSL=true` environment variables (and `PORT=8000`).
4. Click **Deploy**.

---

## Step 3: Make Your Site Appear at the Top of Google Search

Your app already ships with SEO metadata, Open Graph cards, `ElectronicsStore` + `WebApplication` JSON-LD structured data, dynamic `/robots.txt`, and dynamic `/sitemap.xml`. Complete these 2 free steps right after deployment so Google indexes your site rapidly:

1. **Google Search Console (Fastest Indexing):**
   - Open [https://search.google.com/search-console](https://search.google.com/search-console) → **Add property** → **URL prefix** → enter your live URL (e.g. `https://kampango-phones-electronics.onrender.com`).
   - Under **Other verification methods → HTML tag**, copy ONLY the `content="..."` verification code.
   - In Render/Koyeb **Environment Variables**, add `GOOGLE_SITE_VERIFICATION` = `<paste code>` and redeploy (the server automatically injects the verification `<meta>` tag).
   - Click **Verify** in Google Search Console.
   - Go to **Sitemaps** → submit `sitemap.xml`.
   - Go to **URL Inspection** → paste your homepage URL → click **Request Indexing**.

2. **Google Business Profile (Best Way to Rank #1 in Tanzania):**
   - Open [https://business.google.com](https://business.google.com) and create a free listing for **KAMPANGO PHONES AND ELECTRONICS** (Dar es Salaam, Tanzania) and set your live app URL as the **Website**.
   - This puts your shop right at the top of Google Search and Google Maps when customers search for your shop name.

---

## Step 4: Migrating Later to a Local Tanzanian cPanel Host (Sakurahost / Mamdali / DUHosting)

1. Export your database from TiDB Cloud (or download a backup via **Settings → Backup & Recovery**).
2. In cPanel **MySQL Databases**, create your database & user and import the SQL dump via **phpMyAdmin**.
3. Upload `backend/` and built `frontend/dist/` to your hosting account, configure `backend/.env` with your cPanel DB credentials (`DB_SSL=false`), and point your `.co.tz` domain document root to `backend/public`.
