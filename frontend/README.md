# SPECATHON 2026 Frontend

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Copy the example file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your Supabase project URL and anon key.
   
   Get these values from: **Supabase Dashboard → Project Settings → API**
   - `VITE_SUPABASE_URL` - Your project URL (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` - Your anon/public API key

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |

## Common Issues

### "Invalid URL" error when loading data

This occurs when the Supabase environment variables are not set. Make sure you've:
1. Created the `.env` file in the `frontend/` directory
2. Added both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Restarted the dev server after adding the variables

### Port already in use

If port 5173 is in use, Vite will automatically try the next available port (e.g., 5174).

## Project Structure

- `src/components/` - Reusable UI components
- `src/pages/` - Page components for routes
- `src/services/` - API client functions
- `src/admin/` - Admin dashboard components
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
