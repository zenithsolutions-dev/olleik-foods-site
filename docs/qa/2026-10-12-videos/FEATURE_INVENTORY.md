# Olleik Foods: feature inventory for the full-system film

Date: 2026-10-12 · Branch `feat/videos-full` · Status: Pending Review

## How this was built

This inventory was built by reading the app itself:
- every route under `src/app`
- the client components
- the server actions (`"use server"`)
- `src/lib`
- the 15 migrations in `supabase/migrations`

Feature IDs are used by the film's coverage table (`FULL_SYSTEM_REPORT.md`). The film's data comes from `videos/narration/FULL.coverage.json`.

Roles:
- **V** is a visitor (not signed in).
- **C** is a signed-in customer (the portal).
- **A** is the admin.

The film shows the visitor and customer on a phone and the admin on a desktop.

## 1. Visitor (public site)

| ID | Feature | Where | What it writes / reads |
|---|---|---|---|
| V1 | Home page: hero, "Become a customer" call to action, sections, live category tiles | `/` | reads `categories` and `products` (price-free) |
| V2 | Public catalog: top-level categories that have active products | `/catalog` | reads the live catalog (no prices) |
| V3 | Category page: active products with photo, size and unit, no prices | `/catalog/[category]` | reads `products` (active, categorised) |
| V4 | Application form: business, contact, email, phone, address, business type, monthly volume, notes → "Application received" | `/apply` | inserts `leads` (status `new`) |
| V5 | Contact form | `/contact` | inserts `contact_messages` (no admin screen reads it) |
| V6 | Become a vendor (supplier) form | `/suppliers` | inserts `vendor_submissions` (no admin screen reads it) |
| V7 | Customer sign-in, and "Forgot password?" reset with a neutral notice | `/login` | Supabase Auth (the reset email is sent by Supabase Auth) |
| V8 | Invite / reset landing page, then the welcome page "Welcome, {business}" to set a password | `/auth/confirm`, `/auth/set-password` | verifies the link, sets the password, then goes to `/portal?welcome=1` |
| V9 | Static pages: About, Who we serve, Delivery, FAQ, Careers, Resources (3 articles) | various | static content |
| V10 | Newsletter "Subscribe" box in the footer | footer | **decorative: no handler, writes nothing** |

## 2. Customer (portal, phone)

| ID | Feature | Where | Notes |
|---|---|---|---|
| C1 | Dashboard: welcome banner after the first sign-in, "My catalog" count, "Active offers" count | `/portal` | |
| C2 | My catalog: own products only. Each card shows photo, SKU, size, category, a price badged "Your price", the "Offer" price with the regular price struck through, or "Unavailable" | `/portal/catalog` | prices come from `customer_products` and the margin waterfall |
| C3 | Catalog search by name or SKU, category filter, pagination | `/portal/catalog` | |
| C4 | Add to cart and a quantity stepper ("N in cart") | catalog | cart is kept in the browser |
| C5 | Cart: live prices, quantity, remove, total; warnings when items are no longer available | `/portal/cart` | |
| C6 | Checkout: pickup or delivery, notes, "Submit order"; no online payment (payment terms) | `/portal/checkout` | `submit_order_atomic` |
| C7 | Order page: "Order received" banner, status chip (Received / Confirmed / Ready / Completed / Cancelled), lines, total, Invoice button | `/portal/orders/[id]` | |
| C8 | My orders: history with status, refreshes every 30 s, date filter, link to the statement | `/portal/orders` | |
| C9 | Invoice: printable, with the business details; a cancelled order keeps its invoice with a "Cancelled" watermark | `/portal/orders/[id]/invoice` | |
| C10 | Statement for a period: printable | `/portal/orders/statement` | |
| C11 | Offers page: offers set up for this customer | `/portal/offers` | |
| C12 | Account page: business, contact, payment terms (read-only) | `/portal/account` | |
| C13 | Locked out when the account is not active ("Your account isn't active yet") | `/login?status=pending` | |

## 3. Admin (desktop)

| ID | Feature | Where |
|---|---|---|
| A1 | Admin sign-in (only emails on the admin list) | `/admin-login` |
| A2 | Dashboard: new orders right now, today's revenue and profit, pickup/delivery, awaiting confirmation, top products and customers, "Needs your attention" (low stock, invited never signed in, products without cost, customers gone quiet, offers expiring), active offers, recent leads, module tiles | `/admin` |
| A3 | Order alerts: "Enable order alerts", sound on/muted, "N new" badge, tab-title flash, polling | sidebar, `/admin/orders` |
| A4 | Leads: tabs by status, status select (new / contacted / approved / rejected), delete | `/admin/leads` |
| A5 | Add a customer: from approved leads (convert selected / review & convert) or manual entry | `/admin/customers/new` |
| A6 | Customers list: active/archived, search, cards | `/admin/customers` |
| A7 | Customer page: activation badge (Not invited / Invited / Active), setup checklist | `/admin/customers/[id]` |
| A8 | Portal access: "Send email" invite or "Copy link" (one-time link) | customer page |
| A9 | Assigned products: add products (picker), customer price click-to-edit (manual), source chip (rule), profit | customer page |
| A10 | Customer margin (cost + X %), recomputes the computed prices | customer page |
| A11 | Catalog visibility: Assigned only / Entire catalog / Selected categories; hidden products | customer page |
| A12 | Table tools: Export CSV, Recompute prices (preview), Copy from customer, bulk "Set flat price / % off list / Reprice by rules" | customer page |
| A13 | Per-customer offers: Add offer, Edit, Deactivate, Delete, Apply template; summary of discounted products | customer page |
| A14 | Edit account (contact, status active/pending/suspended, payment terms, notes), Archive / Restore | customer page |
| A15 | Customer statement: customer copy and "My copy" (internal, cost and profit) | `/admin/customers/[id]/statement[/internal]` |
| A16 | Assign products to many customers: pick products, pick customers, preview cost/price/profit, "Assign N pairs" | `/admin/assign` |
| A17 | Margin rules: global, product, category, customer, "Overrides customer margins"; automatic recompute | `/admin/pricing` |
| A18 | Offer library: templates (new, edit, archive), "Apply to many…" with preview, Running now, applied batches, Undo batch | `/admin/offers` |
| A19 | Orders list: tabs All / New / Confirmed / Prepared / Completed / Cancelled, date filter | `/admin/orders` |
| A20 | Order page: lines with cost and profit; Confirm order, stock check with "Not enough stock" and "Confirm anyway (oversell)"; Mark prepared; Complete order; Cancel order with a reason; invoice | `/admin/orders/[id]` |
| A21 | Auto-assignment on confirmation: products ordered from an open category join the customer's catalog at the waterfall price | order confirm |
| A22 | Products: table with cost, list price, profit, stock (low / out / oversold), status; banners; Add product; Edit | `/admin/products` |
| A23 | Product dialog: SKU, category, name, photo upload, unit, size, cost, sale price, margin helper, initial stock and low-stock alert, Active | products |
| A24 | Stock: Receive stock (adds; names oversold orders to call), Set count (replaces) | product dialog |
| A25 | Deactivate a product (leaves the public site and portals) | product dialog |
| A26 | Categories: add, edit, delete, one level of subcategories | `/admin/categories` |
| A27 | Documents: Product list (optional cost columns, internal), Low-stock statement, Unavailable statement | `/admin/documents/*` |
| A28 | Analytics: revenue trend, best sellers, slow & non-movers, top customers, gone quiet | `/admin/analytics` |
| A29 | Report builder: presets, period, sections, "Cost & profit (INTERNAL)", print | `/admin/reports` |
| A30 | Date filters on dashboard, orders, products, customers and leads (Today … Custom range) | many pages |

## 4. Cause-and-effect chains (the story the film follows)

| # | Cause (one side) | Effect (other side) | Features |
|---|---|---|---|
| 1 | Admin keeps categories and active products, with photos | The public site lists those categories and products, without prices | A26, A22 → V1, V2, V3 |
| 2 | Visitor applies on `/apply` | A new lead in Leads (tab New) and on the dashboard under Recent leads | V4 → A4, A2 |
| 3 | Admin marks the lead approved and converts it | A customer account (active, COD), with a setup checklist | A4, A5, A7 |
| 4 | Admin copies an invite link (or sends the email) | The customer opens it, sees "Welcome, {business}", sets a password, lands on the portal with the welcome banner. The admin badge goes Invited → Active | A8 → V8, C1 → A7 |
| 5 | Admin assigns products | The customer's catalog fills, each price marked "Your price" | A9 → C2 |
| 6 | Admin types a manual price / sets a customer margin / adds a margin rule | Customer prices change (manual prices are kept by rules) | A9, A10, A17 → C2 |
| 7 | Admin opens a category in Catalog visibility / hides a product / bulk-assigns | Extra products at list price without the badge / product gone / product added | A11, A16 → C2 |
| 8 | Admin adds an offer / applies a template to many | Offers page lists it; catalog shows the offer price | A13, A18 → C11, C2 |
| 9 | Customer searches, adds to cart, checks out (delivery, note) | The order appears in the admin's New tab with the sidebar count, alert and dashboard "awaiting confirmation" | C3–C6 → A19, A3, A2 |
| 10 | Admin confirms (stock short → oversell) | Customer status "Confirmed"; the oversold product becomes "Unavailable" for every customer; an ordered open-category product joins the catalog | A20, A21 → C7, C2 |
| 11 | Admin marks prepared / completes | Customer status "Ready" / "Completed" | A20 → C7 |
| 12 | Admin cancels a second order with a reason | Customer status "Cancelled", invoice watermark; the reason stays with the admin | A20 → C7, C8, C9 |
| 13 | The order exists | Same invoice on both sides; statement = customer copy; internal copy with cost and profit | C9, C10 ↔ A20, A15 |
| 14 | Confirmation took stock | Products show oversold/low; dashboard revenue, profit, attention; stock statements | A22, A2, A27 |
| 15 | Admin receives stock | The oversold order is named; the product is available again for customers | A24 → C2 |
| 16 | Orders over time | Analytics and reports | A28, A29 |
| 17 | Admin adds a product with a photo / deactivates one | It appears on / leaves the public site and the portals | A23, A25 → V3, C2 |
| 18 | Admin edits the account / suspends / restores | Account page shows the change / the customer is locked out / access returns | A14 → C12, C13 |

## 5. Not reachable or not wired in the app (reported, not invented)

- Contact messages (V5) and vendor submissions (V6) are stored, but **no admin screen shows them**.
- The newsletter box (V10) has no handler.
- Invites and password resets are emailed by **Supabase Auth's mailer**. The local demo stack does not send email. The film shows the "Copy link" path, which is the app's no-email alternative, and the reset form's neutral notice.
- Tax is dormant (`taxEnabled: false`). Stripe is installed but not used; there is no online payment.
- **App bug found while capturing:**
  - Offer library → Running now crashes ("Something went wrong") when an amount-off or fixed-price offer is running.
  - Cause: `src/app/admin/offers/running-now.tsx` → `formatDiscount` calls `formatMoney` from a client module on the server.
  - The film uses a percent-off template, so the page works. **The app is not changed.**
