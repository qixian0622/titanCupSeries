# Titan Cup Series

Public tournament ranking website with shared monthly updates powered by Supabase.

## Files

- `index.html`: page structure
- `styles.css`: responsive styling
- `app.js`: rankings logic, Supabase connection, auth, and rendering
- `supabase-config.js`: place your Supabase project URL and anon key here
- `supabase-schema.sql`: database schema and row-level security policies
- `.github/workflows/deploy.yml`: GitHub Pages deployment workflow

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. In `admin_users`, replace `organizer@titancupseries.com` with your real organizer email.
4. Copy `supabase-config.example.js` values into `supabase-config.js`.
5. Set:
   - `url` to your Supabase project URL
   - `anonKey` to your Supabase anon public key
   - `redirectTo` to `https://qixian0622.github.io/titanCupSeries/`

## Publishing Publicly

1. Push this project to a GitHub repository.
2. In GitHub, open `Settings > Pages`.
3. Set the source to `GitHub Actions`.
4. Push to the `main` branch.
5. GitHub Pages will publish the site and give you a public link.

## How Admin Updates Work

- Everyone can view the rankings publicly.
- Only signed-in organizer emails listed in `admin_users` can add or change monthly results.
- Organizers sign in using the email magic link on the website.

## Bulk CSV Import

- The website supports CSV import from the `Import CSV` button.
- CSV header must be exactly: `month,name,placement,points`
- Example row: `2026-03,Titan Alpha,1,50`
- The site also includes a `Download CSV Template` button.

## Custom Domain

1. Buy or use a domain you control, for example `titancupseries.com`.
2. In GitHub `Settings > Pages`, enter that domain in `Custom domain`.
3. In your domain provider, point the domain to GitHub Pages.
4. If you use a root domain, add GitHub Pages A records.
5. If you use a subdomain like `rankings.titancupseries.com`, add a CNAME record pointing to `qixian0622.github.io`.
6. After the custom domain works, update `redirectTo` in `supabase-config.js` to your new final domain.

## Demo Mode

If `supabase-config.js` is empty, the site stays in demo mode using browser storage only.
