# D’Fable Laundry Studio

Next.js App Router + React + TypeScript + Tailwind CSS 4, Firebase Authentication (Google), Firestore, Supabase private Storage, Google Maps/Places, and Lucide icons. Customer web at `/`, responsive shop dashboard/POS at `/dashboard`.

## Local development

Node 22.x required.

```sh
npm ci
# Copy .env.example to .env.local only if .env.local does not already exist.
# Fill Firebase settings. Preserve the existing Google Maps key.
npm run dev
```

Without Firebase credentials, the catalog and responsive UI render in **design preview**. Tracking shows a clearly labelled sample. Login and mutations remain disabled; preview never pretends to save an order. No SQLite or filesystem database is used. The old ignored `data/` files are preserved for reference and are not read by the app.

## Connect Firebase

1. Create a Firebase project, register a Web app, copy its public configuration into `NEXT_PUBLIC_FIREBASE_*` in `.env.local`.
2. Enable **Authentication → Sign-in method → Google**. Add `localhost`, `127.0.0.1` if used, the stable Vercel domain, and your custom domain to Authorized domains.
3. Create a **Firestore** database in production mode. Choose its location before creating real records.
4. Create a Supabase project and a **private** bucket named `laundry-photos`. Set server-only `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (the new `sb_secret_` key), and `SUPABASE_STORAGE_BUCKET`. No public Storage policies are needed. Firebase still handles all login and order data; Supabase publishable keys and JWKS are not needed.
5. Under Project settings → Service accounts, create an Admin SDK service account key. Put project ID, client email, and PEM private key into server-only `FIREBASE_*` variables. Never commit the key JSON or give it a `NEXT_PUBLIC_` prefix.
6. Put verified Google email addresses for store staff in `ADMIN_EMAILS`, separated by commas. Customers cannot grant themselves admin access.
7. Using the Firebase CLI with your own authenticated account, deploy the checked-in rules and index:

```sh
firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes
```

8. Run `npm run check:config`, restart the dev server, and sign in with Google. After changing server credentials or public variables on Vercel, redeploy.

Firestore rules deny direct browser access. Supabase photos are kept in a private bucket; the server refuses public buckets. Next.js verifies Firebase ID tokens and accesses data through the Admin SDK. The customer query needs the checked-in `uid + createdAt` composite index; wait until Firebase reports it ready.

## Deploy to Vercel

- Import the Git repository using the **Next.js** preset. If the repository contains `dfable/` as a subfolder, set Root Directory to `dfable`; if `package.json` is at the repository root, leave Root Directory unchanged.
- Use Node 22.x. Build command `npm run build`, install command `npm ci`. Keep the default Next.js output directory. **Do not use static export or deploy `out/`.** Route handlers require the Vercel Node runtime.
- Configure every key in `.env.example` under Vercel Environment Variables for the intended environment. Keep server credentials secret. Browser Firebase/Maps keys are public configuration and require the documented restrictions.
- Add the final Vercel domain to Firebase Authentication and Google Maps HTTP-referrer restrictions. Preview deployments with different domains also need authorization; prefer a stable staging domain/project.
- Deploy. `/api/health` must return `{"status":"ok"}`. `setup_required` (503) means missing credentials; `database_unavailable` (503) means a project/permissions/connectivity issue. `/api/store` is an actual serverless route, not a file generated into static output.
- Check login → order → dashboard → update weight/ongkir/status → tracking → reload. Test a second customer account: it must not see the first customer's order or photos. Test an account outside `ADMIN_EMAILS`: admin writes must return 403.

Vercel deployment is separate from configuring the Firebase and Supabase projects. Live OAuth, persistence and uploads require the configuration above before launch. `npm run build` verifies compilation, not successful cloud configuration.

## Data and permissions

- `orders`: UID-bound web orders, separate unclaimed walk-in orders, branch ID `cinere`, immutable original tariff, actual weight, confirmed transport fee, status history and manual payment status.
- `users/{uid}`: Google email/name and required normalized WhatsApp number saved transactionally with each web order. Customer browser storage is not used for profiles.
- `walkInCustomers`: name and phone stored by hashed phone identifier. No existing customer account is linked merely by an unverified phone match. Share its private tracking link with the walk-in customer.
- `settings/cinere`: editable prices and promo. Defaults are used until the first admin change.
- `tracking/{unguessableToken}`: capability link to public order progress; it does not disclose name, phone, precise location, care notes, photos, UID or the underlying token.
- `rateLimits/{uid}`: transactional rolling hour order limit (10 customer / 120 admin).
- Supabase Storage path `orders/{uid}/{orderId}.jpg`: private photo, served through an owner/admin-authorized endpoint with no-store caching.

Order creation is idempotent for the same request ID. Customer-provided `source: pos` cannot bypass admin authorization. All admin mutations are verified server-side. Status cannot move backwards; final payment needs confirmed weight and ongkir. A paid invoice cannot change totals unless its paid state is first cleared. Transport may be zero, but unknown transport fees are not silently called free.

Order listing is capped at the latest 500 records per authorized query. The dashboard labels the limit when reached; add pagination and server aggregate reporting before volume grows beyond this range. Firebase project rules/indexes must actually be deployed; committing them alone does not configure Firebase.

## Pricing / business assumptions

Cinere cuci-kering: Rp20,000 up to 10 kg, then Rp2,000/kg. Ironing adds Rp4,000 per actual kg. 5 kg wash + iron = Rp40,000, 10 kg = Rp60,000. Iron-only = Rp4,000/kg. Express adds 50%. Transport has no radius cap in this version and is confirmed by the shop. Existing orders retain their captured tariff after price edits.

Membership is still an explicitly labelled draft package, with no automatic activation or quota ledger. Payment is manually checked by staff; no payment gateway, automatic transfer reconciliation or bank account data is configured. No automated WhatsApp messages are sent. Public tracking visualizes store-entered progress, not courier GPS. Final business rates, account details and operating policies still need owner confirmation before real orders.

## Google Maps

The app uses Google Maps when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is present, with draggable pin, click-to-place, device location and Places (New) address search. Enable **Maps JavaScript API + Places API (New)** and billing, restrict the key to these APIs and your app domains. Without a key the picker uses OpenStreetMap/Leaflet. Geolocation requires HTTPS in production and browser permission. API permission/billing failures remain visible to the user.

- https://developers.google.com/maps/documentation/javascript/get-api-key
- https://developers.google.com/maps/documentation/javascript/place-autocomplete-new
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/admin/setup
- https://vercel.com/docs/frameworks/full-stack/nextjs

## Validation

```sh
npm run test        # pricing, input validation, role policy, tracking privacy
npm run typecheck
npm run build
node scripts/smoke.mjs   # with local preview server running; no data writes
npm run check:config     # lists missing variable names, never secret values
node --conditions=react-server --import tsx scripts/check-services.ts # read-only cloud checks
# Add --upload to verify upload/download/private access with a disposable probe, then delete it.
```

Image assets are local, delivered through Next Image on the customer homepage. Custom visual CSS complements Tailwind utilities and shared component styles. See `docs/image-assets.md` for image-generation provenance. The original logo is user supplied.
