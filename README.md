# D’Fable Laundry Studio

A working local demo for the Cinere branch, built with Next.js 16 App Router, React 19, TypeScript, Lucide icons, Zod validation, and server-side SQLite persistence (Node built-in `node:sqlite`). The customer site is `/`; the shop dashboard/POS is `/dashboard`.

## Run

Requires Node 22.13+ (tested with 22.17.1).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. `npm run build` creates the production build; `npm start` previews it on loopback. `npm run typecheck` checks TypeScript.

## Implemented

- Responsive customer home and pricelist, supplied logo, original laundry photograph, Lucide icons.
- Two-step order form: service, estimated weight, regular/express, compressed photo, care notes, customer details, map pin, address, date and time window.
- OpenStreetMap/Leaflet map preview; Google Maps with draggable pin when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is configured. API billing and key restrictions must be configured separately. Google Places autocomplete is a production follow-up, not yet implemented.
- Server-persisted orders, unique tracking links, tracking timeline and status polling every 15 seconds.
- Store sales summary, order search/filter, walk-in POS, actual weight correction, forward-only order status, manual payment confirmation, price and promotional banner editing.
- Local demo customer profile saved on the device, prefills future orders and filters history by phone.

## Pricing assumptions

Cinere: cuci-kering Rp20,000 up to 10 kg; over 10 kg Rp2,000/kg. Ironing adds Rp4,000 per actual kg. Thus 5 kg cuci + setrika is Rp40,000; 10 kg is Rp60,000. Ironing alone is Rp4,000/kg. Express is +50%. Transport is not included: the shop confirms it separately with no radius limit in this demo. A draft monthly package is display-only and must be approved by the business.

Prices are captured on order creation, so later edits do not retroactively affect existing orders. Actual weights recalculate using that captured tariff. New transactions and edits are serialized in SQLite transactions. Data lives in ignored `data/dfable.sqlite` and persists across server restarts.

## Demo boundary / production follow-up

This is not a production-ready POS. It deliberately binds to localhost and the API rejects non-local hostnames. Host checks are defense in depth, not authentication. Do not expose it through a proxy or tunnel, and use fictional data only. Everyone using this local instance shares demo data and admin access. Customer profiles are not verified accounts.

Before launch: implement OTP provider integration, authenticated admin sessions/roles, per-customer order authorization, CSRF/rate limiting, private photo storage, database migrations and backups, actual bank details and payment proof workflow, finalized transport fees, operational hours/capacity, membership activation/quota ledger, and real multi-branch data isolation. Tracking is shop-updated status, not GPS courier tracking. No WhatsApp messages are sent. No payment gateway is present.

This retains genuine Next.js and Node SQLite; it has not been deployed to Sites/Cloudflare Workers, whose runtime does not run this Node SQLite backend. Choose a persistent Node host or migrate persistence/runtime before deployment.

## Map recommendation

Google Maps is the recommended production integration for map pins plus address autocomplete. Enable Maps JavaScript API, Places API (New), billing, and HTTP-referrer/API restrictions. Never use unrestricted server keys in browser variables. See https://developers.google.com/maps/documentation/javascript/get-api-key and https://developers.google.com/maps/documentation/javascript/place-autocomplete-new.

Google fonts and map tiles require internet. The interface has system-font fallbacks and the map reports tile errors. The generated hero photograph is stored locally in `public/laundry.png`.
