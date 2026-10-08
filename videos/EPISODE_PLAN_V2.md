# Episode Plan V2: the visitor manual and five admin episodes

**Status: all captions Pending Review.** Generated from `src/v2/episodes.mjs` by `node episode-plan.mjs`; storyboards in
`out/storyboards/v2/V2-<EPISODE>-storyboard.png`. Same world as the hero film: Marco guides the visitor manual, Salma guides
the admin episodes. Every screen is a real capture from the local demo copy (fictional data). Style: the guide in a round
window reacting (point, thumbs up, nod, blink), the camera easing onto the active control, a hand-drawn marker circle and
arrow drawing on, step numbers printing as small order tickets, a burned-in English caption, SRT alongside, no voiceover.
Admin episodes open with a one-line problem, show the fix, and end with a “Coming up” tease (episode 5 ends the tour).

Brief vs product: the brief's episode 5 is “Invites and settings”. The product has **no settings page** (business details
live in code, `src/lib/business.ts`, still placeholders). Episode 5 is therefore **“Invites and Access”**: the portal
invite on the customer page, catalog visibility, and the admin email allowlist. If a settings page is built later, a
short episode 6 can be added.

| Episode | Length | Guide | Beats |
|---|---|---|---|
| Marco's First Order (visitor manual) | 1:22 (about 85 s) | Marco | 16 |
| Admin Episode 1 · Orders | 0:38 (about 40 s) | Salma | 8 |
| Admin Episode 2 · Customers and Approvals | 0:32 (about 35 s) | Salma | 7 |
| Admin Episode 3 · Products and Prices | 0:32 (about 35 s) | Salma | 7 |
| Admin Episode 4 · Margins and Reports | 0:32 (about 35 s) | Salma | 7 |
| Admin Episode 5 · Invites and Access | 0:31 (about 30 s) | Salma | 6 |

## Marco's First Order (visitor manual)

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | title | — | — |  | From applying to his first statement. |  | Pending Review |
| 2 | 0:04 | screen | visitor/home-hero | headline |  | It starts on the Olleik Foods site. | point | Pending Review |
| 3 | 0:09 | screen | visitor/apply-empty → visitor/apply-filled | businessName | 1 | Apply for a wholesale account. | point | Pending Review |
| 4 | 0:15 | screen | visitor/apply-filled | submit |  | Send it. The Olleik team reviews it. | thumbs | Pending Review |
| 5 | 0:20 | screen | visitor/p-login | submit | 2 | Approved? Sign in with your email. | focus | Pending Review |
| 6 | 0:25 | screen | visitor/p-portal | catalogCard |  | Your portal: your catalog and your offers. | point | Pending Review |
| 7 | 0:30 | screen | visitor/p-catalog | search | 3 | Search or filter your catalog. | focus | Pending Review |
| 8 | 0:35 | screen | visitor/p-catalog-card | priceBadge |  | Every item shows your account's price. | point | Pending Review |
| 9 | 0:40 | screen | visitor/p-catalog-card → visitor/p-catalog-added | addToCart | 4 | Add what you need to the cart. | focus | Pending Review |
| 10 | 0:45 | screen | visitor/p-cart | checkout |  | Check the cart, then go to checkout. | focus | Pending Review |
| 11 | 0:50 | screen | visitor/p-checkout-filled | delivery | 5 | Delivery or pickup, plus a note. | focus | Pending Review |
| 12 | 0:56 | screen | visitor/p-checkout-filled | submit |  | Submit. Payment stays on your usual terms. | thumbs | Pending Review |
| 13 | 1:01 | screen | visitor/p-placed | banner | 6 | Received: the team confirms it next. | focus | Pending Review |
| 14 | 1:06 | screen | visitor/p-orders | first |  | Follow it: received, confirmed, ready, completed. | point | Pending Review |
| 15 | 1:12 | screen | visitor/statement | print | 7 | Print a statement for any period. | focus | Pending Review |
| 16 | 1:17 | outro | — | — |  | Become a customer |  | Pending Review |

## Admin Episode 1 · Orders

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | problem | — | — |  | Three new orders, and the day just started. |  | Pending Review |
| 2 | 0:04 | screen | admin/dashboard | newOrders | 1 | New orders show first on your dashboard. | point | Pending Review |
| 3 | 0:09 | screen | admin/orders-new | newTab |  | Open the New tab. | focus | Pending Review |
| 4 | 0:14 | screen | admin/order-new | note | 2 | Read the items, the profit and the customer's note. | focus | Pending Review |
| 5 | 0:20 | screen | admin/order-new → admin/order-confirmed | confirm |  | Confirm: the stock is deducted. | thumbs | Pending Review |
| 6 | 0:25 | screen | admin/order-prepared | complete | 3 | Packed? Mark it prepared, then complete it. | focus | Pending Review |
| 7 | 0:30 | screen | admin/invoice | print |  | Every order has an invoice to print or save. | focus | Pending Review |
| 8 | 0:35 | next | — | — |  | Next: a new customer. |  | Pending Review |

## Admin Episode 2 · Customers and Approvals

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | problem | — | — |  | A new restaurant applied last night. |  | Pending Review |
| 2 | 0:04 | screen | admin/leads | first | 1 | Applications land in Leads. | point | Pending Review |
| 3 | 0:09 | screen | admin/leads-approved | firstStatus |  | Set the status: approved. | focus | Pending Review |
| 4 | 0:14 | screen | admin/customer-new | lead | 2 | Add the customer from the approved lead. | focus | Pending Review |
| 5 | 0:19 | screen | admin/customers | first |  | Every customer, with status and terms. | focus | Pending Review |
| 6 | 0:24 | screen | admin/customer-prices | firstPrice | 3 | Each customer has their own prices. | thumbs | Pending Review |
| 7 | 0:29 | next | — | — |  | Next: products and prices. |  | Pending Review |

## Admin Episode 3 · Products and Prices

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | problem | — | — |  | A new item comes in on Monday. |  | Pending Review |
| 2 | 0:04 | screen | admin/products | outRow | 1 | Stock, cost and price in one list. | focus | Pending Review |
| 3 | 0:09 | screen | admin/product-add → admin/product-filled | name |  | Add the product. | point | Pending Review |
| 4 | 0:14 | screen | admin/product-filled | price | 2 | Cost stays private; customers see the sale price. | focus | Pending Review |
| 5 | 0:19 | screen | admin/categories | table |  | Put it in a category. | focus | Pending Review |
| 6 | 0:24 | screen | admin/assign | headline | 3 | Assign it to the customers who buy it. | thumbs | Pending Review |
| 7 | 0:29 | next | — | — |  | Next: margins and reports. |  | Pending Review |

## Admin Episode 4 · Margins and Reports

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | problem | — | — |  | Are the prices still right? |  | Pending Review |
| 2 | 0:04 | screen | admin/pricing | global | 1 | Margin rules turn cost into each price. | point | Pending Review |
| 3 | 0:09 | screen | admin/analytics | period |  | See what sells, by period. | focus | Pending Review |
| 4 | 0:14 | screen | admin/analytics-table | table | 2 | Units, revenue and profit per product. | focus | Pending Review |
| 5 | 0:19 | screen | admin/reports | print |  | Build a report, then print it. | focus | Pending Review |
| 6 | 0:24 | screen | admin/low-stock | table | 3 | Low stock is one click away. | thumbs | Pending Review |
| 7 | 0:29 | next | — | — |  | Next: invites and access. |  | Pending Review |

## Admin Episode 5 · Invites and Access

| # | Time | Kind | Screen (real capture) | Callout on | Step | Caption / line | Guide | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 0:00 | problem | — | — |  | The new customer can't sign in yet. |  | Pending Review |
| 2 | 0:04 | screen | admin/customer-detail | portal | 1 | Invite them to the portal from their page. | point | Pending Review |
| 3 | 0:10 | screen | admin/customer-detail | portal |  | No email? Copy the invite link and send it yourself. | thumbs | Pending Review |
| 4 | 0:15 | screen | admin/customer-detail | visibility | 2 | Choose which products they can see. | focus | Pending Review |
| 5 | 0:21 | screen | admin/login | email | 3 | Only emails on the admin list can open the admin. | focus | Pending Review |
| 6 | 0:26 | outro | — | — |  | That's the tour. |  | Pending Review |

## Deliverables per episode (after Go)

1920×1080 30 fps H.264 with sound design (no-music and quiet-bed versions), burned-in English captions, a separate SRT,
a poster, and for the visitor manual a 1080×1920 vertical cut. Re-capture only if a scene needs a new angle.
