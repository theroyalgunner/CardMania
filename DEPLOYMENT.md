# CardMania Deployment Guide

## 1. Local final test

```bash
npm install --registry=https://registry.npmjs.org/
npm run build
npm run dev
```

Test:
- `/login`
- `/scanner`
- `/collection`
- `/portfolio`
- `/market`
- `/reports`
- `/launch`

## 2. Required environment variables

Create `.env.local` locally and set the same values in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
```

## 3. Supabase

Run both SQL files in this order:

1. `supabase/schema.sql`
2. `supabase/storage.sql`

Confirm:
- Email auth works
- `card-images` storage bucket exists
- Collection cards save and load

## 4. Vercel

1. Import this folder as a new Vercel project.
2. Add the environment variables above.
3. Deploy.
4. Add the Vercel URL to Supabase Auth URL configuration.

## 5. Production checklist

- Build passes
- Login works
- Scanner saves cards
- Front/back images upload
- Collection loads from cloud
- Reports export correctly
- Mobile layout checked on iPhone/iPad
