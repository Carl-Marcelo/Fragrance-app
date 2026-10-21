# Project: Personal Perfume Collection Manager

Act as a senior React developer and UI/UX designer. Build a complete, responsive, and functional personal perfume web application designed for managing my fragrance collection.

Use [Fragrantica](https://www.fragrantica.com/) as inspiration for fragrance information and discovery, but do not copy its entire website or build social networking features.

## 1. Technology Stack

Use the following technologies:

- React + TypeScript + Vite
- Tailwind CSS
- Lucide icons
- Vercel for hosting
- Supabase PostgreSQL for cloud storage
- Supabase Auth for authentication
- Supabase Row Level Security (RLS) for database security

Keep the application affordable, maintainable, and suitable for personal use. Prefer free-tier services where practical.

## 2. Website Access and Privacy

The website should be publicly accessible, but my personal perfume collection must remain private.

**Public pages:**
- Home page
- Public fragrance catalog, if available
- Fragrance details and scent profiles
- General fragrance guides
- General spray recommendations
- Search and filtering for public fragrance information
- Login page

**Private dashboard:**
- My Collection
- My Wishlist
- My Favorites
- Previously Owned
- Personal ratings and notes
- Purchase history and collection value
- Bottle-level tracker
- Personal fragrance wear log
- Personalized recommendations based on my collection

Only I should be able to access and modify my private records.

Use Supabase Auth for secure login. Disable public registration after my owner account is created unless explicitly needed. Protect private data through database policies, not merely frontend route restrictions.

## 3. Cloud Synchronization

I want to access my collection from my PC, laptop, and phone.

Requirements:
- Store collection data in Supabase PostgreSQL.
- Synchronize data across devices when signed in.
- Persist changes after refreshing or reopening the website.
- Include loading, saving, and error states.
- Support JSON export and import with validation.
- Provide backup and restore instructions.
- Handle network failures gracefully.

Do not rely solely on browser storage for the main collection.

## 4. Perfume Collection Management

Implement complete CRUD functionality: create, read, update, and delete perfumes.

Each perfume should support:

- Perfume name and brand
- Concentration: EDT, EDP, Parfum, Extrait, Elixir, etc.
- Release year
- Fragrance family
- Scent description
- Top, middle, and base notes
- Main accords
- Sweetness rating
- Freshness rating
- Darkness rating
- Masculinity rating
- Projection and longevity
- Weather suitability
- Daytime and nighttime suitability
- Office and date-night suitability
- Special-occasion suitability
- Personal rating and notes
- Bottle size in ml
- Purchase price and date
- Remaining bottle level
- Fragrance image
- External source links
- Collection status

Allow optional fields to remain blank. Support manual perfume entry and editing of imported information.

Distinguish verified fragrance information from subjective opinions and estimates.

## 5. Collection Tracker and Wishlist

Create separate views for:

- My Collection
- My Wishlist
- My Favorites
- Previously Owned

Features:
- Add, edit, and remove perfumes.
- Move wishlist perfumes into the owned collection.
- Mark perfumes as favorites.
- Track bottle size and remaining percentage.
- Record purchase prices and dates.
- Calculate total collection value from recorded prices.
- Identify perfumes running low.
- Record why I want a particular fragrance.
- Compare owned perfumes against wishlist items.
- Sort by name, brand, rating, price, and date added.

## 6. Search, Filtering, and Sorting

Implement:
- Search by perfume name and brand.
- Alphabetical A–Z filter.
- Fragrance-family filter.
- Scent-note and accord filters.
- Concentration filter.
- Sweetness, freshness, darkness, and masculinity filters.
- Projection and longevity filters.
- Weather suitability filter.
- Occasion filter.
- Collection status filter.
- Favorites filter.
- Sorting by rating, price, name, and recently added.
- Multiple simultaneous filters.
- Clear-all-filters button.

Filters should update results immediately and work together correctly.

## 7. Philippine Weather Spray Guide

Tailor fragrance recommendations to the hot, humid, and rainy conditions commonly experienced in the Philippines.

Include these scenarios:

1. Hot Daytime
2. Normal Daytime
3. Office
4. Night Date
5. Special Occasion

For each perfume and scenario, provide:
- Suggested spray count or starting range.
- Recommended spray locations.
- Application technique.
- Whether skin, clothing, or both are appropriate.
- Expected projection and overspraying risk.
- Suitability for heat, humidity, rain, and air-conditioned environments.
- A short explanation of the recommendation.

Use configurable recommendations that account for fragrance strength, concentration, performance, occasion, and environment. Allow me to customize spray recommendations.

Treat spray counts as practical estimates, not scientifically exact measurements.

The spray guide must work without an external API.

## 8. Fragrance Information and Images

Where possible, retrieve fragrance information from legitimate sources, prioritizing official brand websites and reputable fragrance references.

Requirements:
- Support fragrance images.
- Provide external source links.
- Identify unavailable or unverified information.
- Allow manual entry and corrections.
- Include image placeholders when images are unavailable.
- Respect copyright, licensing, and website terms.
- Do not assume Fragrantica provides an authorized public API.
- Avoid unauthorized scraping or bypassing access restrictions.

The application must remain functional if external sources are unavailable.

Keep public fragrance information separate from my private collection records. Never expose personal ratings, prices, notes, or ownership status publicly by default.

## 9. Dashboard

Create a useful dashboard showing:
- Total owned perfumes
- Wishlist count
- Recorded collection value
- Favorite fragrances
- Recently added perfumes
- Low-bottle alerts
- Highest-rated fragrances
- Wear-log summaries, if implemented
- Quick access to the spray guide
- Recommendations based on saved fragrance information

Use actual saved data. Do not fabricate statistics.

## 10. Design and User Experience

Create a premium, minimalist interface inspired by luxury fragrance brands. Use the **first visual reference previously provided as the main styling direction**. Treat it as inspiration rather than a design to copy exactly.

My preferred visual style is:
- Warm, soft, and easy on the eyes.
- Light and airy, with generous whitespace and a calm visual hierarchy.
- Elegant and understated, like a modern personal fragrance journal.
- Refined typography, subtle borders, soft shadows, and restrained use of accent colors.
- A balanced layout that feels premium without looking overly decorative, crowded, or too dark.
- Fragrance cards with clear imagery, readable details, and consistent spacing.
- Smooth, subtle transitions only where they improve usability.

### Color and theme preferences

- Provide a fully working **Light / Dark theme toggle** that the user can switch at any time.
- Make the light theme the default.
- The light theme should use warm off-white or soft neutral backgrounds rather than harsh pure white everywhere.
- Use gentle, readable text contrast and muted accent colors. Avoid overly saturated colors, neon accents, and excessive gradients.
- The dark theme should feel comfortable and refined, using deep charcoal or warm dark neutrals rather than pure black everywhere.
- Ensure text, cards, forms, dialogs, menus, borders, and interactive states remain readable in both themes.
- Persist the selected theme across refreshes and devices where practical; if the preference is stored in the cloud, keep it associated with my authenticated account.
- Respect the device's theme preference on the first visit when practical, while allowing my manual selection to take priority afterward.

### Layout and interaction

- Responsive on desktop, laptop, tablet, and mobile.
- Use a clear navigation system for the public pages and private dashboard.
- Make collection management, filtering, and the spray guide easy to find and use.
- Use elegant, consistent fragrance cards and detail pages.
- Keep forms simple and group related fields logically.
- Use accessible labels, keyboard navigation, visible focus states, and sufficient contrast.
- Include clear loading, empty, error, success, and confirmation states.
- Use subtle animations and transitions; prioritize performance and accessibility over visual effects.
- Avoid unnecessary clutter, excessive rounded cards, heavy shadows, large gradients, and decorative elements that compete with fragrance information.

The application should feel like a warm, modern, premium personal fragrance journal—not a social networking website or a generic admin dashboard.

Do not reproduce the reference exactly. Capture its overall warmth, lightness, and visual comfort while creating a coherent design suited to this application's features.

Prioritize usability, visual consistency, and working functionality over unnecessary effects.

## 11. Database and Security

Use Supabase PostgreSQL with appropriate migrations and database relationships.

Requirements:
- Enable Row Level Security on tables containing private data.
- Restrict private collection records to my authenticated account.
- Apply appropriate SELECT, INSERT, UPDATE, and DELETE policies.
- Secure uploaded images and private storage.
- Validate data and enforce authorization.
- Never expose service-role keys or other privileged credentials in frontend code.
- Do not make private tables publicly readable to simplify development.
- Include tests or clear verification steps for unauthorized access.

Public fragrance reference records may be readable without login only when explicitly intended.

## 12. Deployment

Prepare the project for deployment on Vercel.

Include:
- Production build configuration
- Correct routing and refresh behavior
- Supabase SQL migrations
- `.env.example` with placeholders only
- `.gitignore` for local secrets
- Authentication and redirect configuration
- Database initialization instructions
- Secure environment variable configuration
- GitHub and Vercel deployment instructions
- Optional custom-domain instructions
- Troubleshooting for common deployment issues

The core application must not require an AI API, chatbot, paid fragrance API, or weather API.

Use free-tier services where practical and identify any possible costs or usage limits.

## 13. Development Workflow

Build the application in these phases:

**Phase 1:** Project setup, database schema, authentication, and security.

**Phase 2:** Dashboard, perfume CRUD, collection, wishlist, and cloud synchronization.

**Phase 3:** Search, filtering, sorting, and perfume comparison.

**Phase 4:** Philippine weather spray guide, fragrance references, and images.

**Phase 5:** Export/import, responsive testing, security checks, and deployment.

Inspect the existing project before modifying files. Preserve useful existing work.

Do not stop at a static mockup. Implement working interactions, persistent data, secure access, and a reproducible deployment process.

Provide the complete source code, database migrations, setup instructions, environment configuration, deployment guide, and a list of implemented features and remaining limitations.

**Final goal:** Build a reliable, secure, publicly accessible personal perfume management website with a private cloud-synchronized collection, wishlist, fragrance database, and dynamic spray guide tailored to Philippine weather.
