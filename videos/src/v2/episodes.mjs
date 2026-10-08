// V2 manuals (creative brief V2 §5): the visitor manual "Marco's first order" and five short admin episodes with Salma.
// Story-led walkthroughs on the REAL captures (public/footage, local demo copy, fictional data): a character guide in
// the corner, camera on the active control, hand-drawn callouts, step numbers that print as tickets.
// Each beat: kind "title" | "problem" | "screen" | "next" | "outro"; seconds; screen beats name a capture and a box.
// All captions Pending Review.
const FPS = 30;

const V = (shot, box, seconds, caption, extra = {}) => ({ kind: "screen", shot, box, seconds, caption, ...extra });

const RAW = [
  {
    id: "VISITOR", title: "Marco's First Order (visitor manual)", guide: "marco", length: "about 85 s",
    beats: [
      { kind: "title", seconds: 4, title: "Marco's first order", line: "From applying to his first statement." },
      V("visitor/home-hero", "headline", 5, "It starts on the Olleik Foods site.", { gesture: "point", zoom: 2.0 }), // tight: the hero stats below are placeholders
      V("visitor/apply-empty", "businessName", 6, "Apply for a wholesale account.", { step: 1, then: "visitor/apply-filled", gesture: "point" }),
      V("visitor/apply-filled", "submit", 5, "Send it. The Olleik team reviews it.", { gesture: "thumbs" }),
      V("visitor/p-login", "submit", 5, "Approved? Sign in with your email.", { step: 2 }),
      V("visitor/p-portal", "catalogCard", 5, "Your portal: your catalog and your offers.", { gesture: "point" }),
      V("visitor/p-catalog", "search", 5, "Search or filter your catalog.", { step: 3 }),
      V("visitor/p-catalog-card", "priceBadge", 5, "Every item shows your account's price.", { gesture: "point" }),
      V("visitor/p-catalog-card", "addToCart", 5, "Add what you need to the cart.", { step: 4, then: "visitor/p-catalog-added" }),
      V("visitor/p-cart", "checkout", 5, "Check the cart, then go to checkout."),
      V("visitor/p-checkout-filled", "delivery", 6, "Delivery or pickup, plus a note.", { step: 5 }),
      V("visitor/p-checkout-filled", "submit", 5, "Submit. Payment stays on your usual terms.", { gesture: "thumbs" }),
      V("visitor/p-placed", "banner", 5, "Received: the team confirms it next.", { step: 6 }),
      V("visitor/p-orders", "first", 6, "Follow it: received, confirmed, ready, completed.", { gesture: "point" }),
      V("visitor/statement", "print", 5, "Print a statement for any period.", { step: 7 }),
      { kind: "outro", seconds: 5, line: "Become a customer", url: "olleik-foods-site.vercel.app" },
    ],
  },
  {
    id: "EP1", title: "Admin Episode 1 · Orders", guide: "salma", length: "about 40 s",
    beats: [
      { kind: "problem", seconds: 4, line: "Three new orders, and the day just started." },
      V("admin/dashboard", "newOrders", 5, "New orders show first on your dashboard.", { step: 1, gesture: "point" }),
      V("admin/orders-new", "newTab", 5, "Open the New tab."),
      V("admin/order-new", "note", 6, "Read the items, the profit and the customer's note.", { step: 2 }),
      V("admin/order-new", "confirm", 5, "Confirm: the stock is deducted.", { then: "admin/order-confirmed", gesture: "thumbs" }),
      V("admin/order-prepared", "complete", 5, "Packed? Mark it prepared, then complete it.", { step: 3 }),
      V("admin/invoice", "print", 5, "Every order has an invoice to print or save."),
      { kind: "next", seconds: 3, line: "Next: a new customer." },
    ],
  },
  {
    id: "EP2", title: "Admin Episode 2 · Customers and Approvals", guide: "salma", length: "about 35 s",
    beats: [
      { kind: "problem", seconds: 4, line: "A new restaurant applied last night." },
      V("admin/leads", "first", 5, "Applications land in Leads.", { step: 1, gesture: "point" }),
      V("admin/leads-approved", "firstStatus", 5, "Set the status: approved."),
      V("admin/customer-new", "lead", 5, "Add the customer from the approved lead.", { step: 2 }),
      V("admin/customers", "first", 5, "Every customer, with status and terms."),
      V("admin/customer-prices", "firstPrice", 5, "Each customer has their own prices.", { step: 3, gesture: "thumbs" }),
      { kind: "next", seconds: 3, line: "Next: products and prices." },
    ],
  },
  {
    id: "EP3", title: "Admin Episode 3 · Products and Prices", guide: "salma", length: "about 35 s",
    beats: [
      { kind: "problem", seconds: 4, line: "A new item comes in on Monday." },
      V("admin/products", "outRow", 5, "Stock, cost and price in one list.", { step: 1 }),
      V("admin/product-add", "name", 5, "Add the product.", { then: "admin/product-filled", gesture: "point" }),
      V("admin/product-filled", "price", 5, "Cost stays private; customers see the sale price.", { step: 2 }),
      V("admin/categories", "table", 5, "Put it in a category."),
      V("admin/assign", "headline", 5, "Assign it to the customers who buy it.", { step: 3, gesture: "thumbs" }),
      { kind: "next", seconds: 3, line: "Next: margins and reports." },
    ],
  },
  {
    id: "EP4", title: "Admin Episode 4 · Margins and Reports", guide: "salma", length: "about 35 s",
    beats: [
      { kind: "problem", seconds: 4, line: "Are the prices still right?" },
      V("admin/pricing", "global", 5, "Margin rules turn cost into each price.", { step: 1, gesture: "point" }),
      V("admin/analytics", "period", 5, "See what sells, by period."),
      V("admin/analytics-table", "table", 5, "Units, revenue and profit per product.", { step: 2 }),
      V("admin/reports", "print", 5, "Build a report, then print it."),
      V("admin/low-stock", "table", 5, "Low stock is one click away.", { step: 3, gesture: "thumbs" }),
      { kind: "next", seconds: 3, line: "Next: invites and access." },
    ],
  },
  {
    id: "EP5", title: "Admin Episode 5 · Invites and Access", guide: "salma", length: "about 30 s",
    beats: [
      { kind: "problem", seconds: 4, line: "The new customer can't sign in yet." },
      V("admin/customer-detail", "portal", 6, "Invite them to the portal from their page.", { step: 1, gesture: "point" }),
      V("admin/customer-detail", "portal", 5, "No email? Copy the invite link and send it yourself.", { gesture: "thumbs" }),
      V("admin/customer-detail", "visibility", 6, "Choose which products they can see.", { step: 2 }),
      V("admin/login", "email", 5, "Only emails on the admin list can open the admin.", { step: 3 }),
      { kind: "outro", seconds: 5, line: "That's the tour.", url: "olleik-foods-site.vercel.app/admin" },
    ],
  },
];

/** Resolved timing (frames) per episode. */
export const EPISODES = RAW.map((ep) => {
  let at = 0;
  const beats = ep.beats.map((b) => {
    const from = at;
    const to = at + Math.round(b.seconds * FPS);
    at = to;
    return { ...b, from, to };
  });
  const total = at;
  return { ...ep, beats, frames: total, seconds: Math.round(total / FPS) };
});
export const episodeOf = (id) => EPISODES.find((e) => e.id === id);
