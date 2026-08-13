# AutoMarket — Auth, Marketplace, Cart & Checkout

This covers:
1. Registration (Client / Service Provider / Shop), waiver acceptance, login, JWT sessions, role-based dashboard routing
2. **Marketplace**: Shops post products, Service Providers post services, Clients browse both, add to cart, and check out

## Project structure

```
automotive-app/
├── backend/      Express + MongoDB (Mongoose) API
└── mobile/       Expo React Native app (TypeScript)
```

## Backend setup

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your MongoDB Atlas URI + JWT secrets (see prior instructions below).
4. `npm run dev`

### New endpoints (on top of the auth endpoints from before)

| Method | Route | Auth | Description |
|--------|-------|------|--------------|
| GET    | /api/products | Public | Browse all products (filters: category, search, shop, page, limit) |
| GET    | /api/products/:id | Public | Product detail |
| GET    | /api/products/mine | Shop only | This shop's own products |
| POST   | /api/products | Shop only | Create a product |
| PUT    | /api/products/:id | Shop only (owner) | Edit a product |
| DELETE | /api/products/:id | Shop only (owner) | Delete a product |
| GET    | /api/services | Public | Browse all services (filters: category, search, provider, page, limit) |
| GET    | /api/services/:id | Public | Service detail |
| GET    | /api/services/mine | Provider only | This provider's own services |
| POST   | /api/services | Provider only | Create a service |
| PUT    | /api/services/:id | Provider only (owner) | Edit a service |
| DELETE | /api/services/:id | Provider only (owner) | Delete a service |
| GET    | /api/businesses/shops | Public | List shops (with product count + rating) |
| GET    | /api/businesses/shops/:id | Public | Shop detail |
| GET    | /api/businesses/providers | Public | List providers (with service count + rating) |
| GET    | /api/businesses/providers/:id | Public | Provider detail |
| GET    | /api/cart | Client only | View cart |
| POST   | /api/cart/items | Client only | Add item (product or service) |
| PUT    | /api/cart/items/:cartItemId | Client only | Update quantity |
| DELETE | /api/cart/items/:cartItemId | Client only | Remove item |
| DELETE | /api/cart | Client only | Clear cart |
| POST   | /api/orders/checkout | Client only | Place order from cart |
| GET    | /api/orders/mine | Client only | Order history |
| GET    | /api/orders/incoming | Shop/Provider only | Orders containing their items |
| GET    | /api/orders/:id | Owner or seller | Single order detail |

### Images

Product/service images are stored as **base64 strings directly in MongoDB** (per your request — no third-party signup needed). Trade-off: this bloats document size and will slow down at scale. List views deliberately exclude full image arrays and only return a lightweight `thumbnail` (first image) to keep browsing fast; full images only load on detail pages. If the catalog grows significantly, migrating to a CDN (e.g. Cloudinary) is the natural next step — the `images: string[]` field shape wouldn't need to change, just what's stored in it (URLs instead of base64).

## Mobile app setup

Same as before — `cd mobile && npm install && npx expo start`. Check `src/api/client.ts` for the base URL if testing on a physical device.

### New screens

**Client side:**
- Shops list → Shop detail → Products grid (filterable by category, searchable) → Product detail (specs table, qty stepper, add to cart)
- Providers list → Provider detail → Services grid → Service detail (with duration/availability instead of stock)
- Cart (quantity controls, remove items, running total)
- Checkout (delivery address, phone, notes → places order, clears cart)
- Order confirmation screen

**Shop side:**
- My Products (list, edit, delete)
- Product form (create/edit): name, price, category, description, dynamic specs (key-value rows), up to 5 photos, stock, condition, delivery estimate

**Service Provider side:**
- My Services (list, edit, delete)
- Service form (create/edit): name, price, category, description, dynamic specs, up to 5 photos, duration estimate, availability

## What was tested

Same approach as before — no live DB access in this sandbox, so:
- **All new Mongoose models** (Product, Service, Cart, Order) — validated directly with real `.validate()` calls: required fields, enums, image count limits, cart item type/reference consistency, order item snapshot requirements. All passing.
- **Route wiring** — confirmed `/mine` is declared before `/:id` in both product and service routes (so Express doesn't try to parse "mine" as a Mongo ObjectId), confirmed role gating (`authorize(...)`) matches the spec on every new route, confirmed ownership checks in update/delete controllers.
- **TypeScript** — `npx tsc --noEmit` passes cleanly across the entire mobile app (all new screens, contexts, API layers, navigation types) with zero errors.
- **Full live flow (post product → browse → add to cart → checkout)** — not run here, since it needs your Atlas connection. Please test this end-to-end on your machine and let me know what happens.

## Known limitations / next steps

- No payment gateway — checkout creates a "pending" order; payment is assumed to happen directly between client and seller
- No push notifications for new orders
- No reviews/ratings submission yet (the rating fields exist on the models but nothing writes to them yet)
- No image compression beyond what `expo-image-picker`'s `quality: 0.5` setting provides — worth monitoring payload sizes as the catalog grows
- Order cancellation/status updates (confirmed → completed) have no UI yet, only the data model supports it

---

## Backend setup (original auth-only instructions, still accurate)

1. `cd backend`
2. `npm install`
3. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
4. In `.env`, set `MONGO_URI` to your **MongoDB Atlas** connection string, e.g.:
   ```
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/automotive_marketplace?retryWrites=true&w=majority
   ```
5. Set real values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
6. `npm run dev`

## Mobile app setup (original instructions, still accurate)

1. `cd mobile`
2. `npm install`
3. Check `src/api/client.ts` → `getBaseUrl()` for your environment (emulator vs physical device).
4. `npx expo start`

