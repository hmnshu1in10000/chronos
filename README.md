# Chronos: 12-Hour Study Timer & Tracker with Supabase

Chronos is a premium, responsive, serverless single-page productivity app built with **Vite** and **Supabase**. It is designed to track a strict **12-hour daily study routine** (50 minutes study, followed by a 10-minute break) and sync study data across your laptop, tablet, and mobile.

---

## Key Features

- **Dual-Mode Loop Timer**: 50-minute study and 10-minute break loops.
- **Background Resilient**: Uses timestamp comparisons to remain accurate even when the browser tab is minimized or backgrounded.
- **Custom Synth Alarms**: Web Audio API generates beautiful, crisp notification chimes when sessions finish (no external audio files required).
- **Today's Goal Tracker**: Visual grid of 12 slot indicators that glow purple as you complete sessions.
- **Advanced Insights**:
  - Displays slots completed today and total all-time slots.
  - History log showing slots finished on previous days.
  - **Daily Average Calculation**: Automatically excludes Sundays and Sunday slots from the average calculation.
- **Password Toggle**: Show/hide password option (eye icon) inside auth forms.
- **Cloud Sync**: 100% serverless data persistence with Supabase Auth and Database. 
- **Offline-First**: Logs slots locally first, and uploads them to the cloud once authenticated. Automatically resolves duplicates using client-generated UUIDs.
- **Test Mode**: Includes a "Test Mode" toggle that scales the timer (50 seconds study / 10 seconds break) for verification.

---

## Supabase Database Setup

To use the cloud synchronization, you will need to connect the app to a free project on [Supabase](https://supabase.com):

1. **Create a Supabase Project**.
2. **Setup the Slots Table**: Go to the **SQL Editor** in your Supabase dashboard, create a new query, paste the contents of the [database.sql](database.sql) file in this repository, and click **Run**.
3. **Enable Auth**: Ensure Email/Password provider is enabled in your Supabase Project settings (Authentication -> Providers -> Email).

---

## Configuration

You can connect the app to your Supabase project in two ways:

### Option A: Local Settings UI (Easiest)
1. Launch the app.
2. Click the **Gears (Settings) Icon** in the top right.
3. Paste your **Supabase Project URL** and **Supabase Anon Key** (found in your Supabase Settings -> API).
4. Save credentials. The app will reload and connect. These credentials are saved securely in your browser's local storage.

### Option B: Environment Variables
Create a `.env` file in the root of your project directory and insert:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

---

## Local Development

Make sure you have [Node.js](https://nodejs.org/) installed.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the Local URL displayed in your terminal (typically `http://localhost:5173`).

---

## Deployment to Vercel

This app is fully optimized for **Vercel** serverless deployment:

1. Push this code to your GitHub repository.
2. Go to [Vercel](https://vercel.com/) and create a new project.
3. Import your GitHub repository.
4. Set the following build settings (should detect automatically):
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. (Optional) Add your Supabase credentials in the **Environment Variables** section:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Click **Deploy**. Vercel will build and host the app under a public HTTPS URL.
