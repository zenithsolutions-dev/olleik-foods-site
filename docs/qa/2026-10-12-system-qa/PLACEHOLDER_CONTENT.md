# Placeholder-looking content on the public site (owner to supply real content)

Nothing here was changed or replaced: inventing business facts is the owner's call. Paths are relative to the repo root;
`L` = `src/app/(marketing)/layout.tsx`, `H` = `src/app/(marketing)/page.tsx`. Line numbers are as of branch `fix/system-qa`.

## Obvious dummies (must change before launch)

| Where | Text | Notes |
|---|---|---|
| L:163-164, contact/page.tsx:187-190 | `(000) 000-0000`, link `tel:+10000000000` | The only phone number on the site. |
| L:158-159, H:833, contact/page.tsx:105,176-179, suppliers/page.tsx:126,181-184, careers/page.tsx:128 | `sales@olleikfoods.com` | Confirm the mailbox exists; careers and "purchasing team" also go to it. |
| L:167, contact/page.tsx:197 | `Mon – Sat · 7am – 5pm` | Hours are invented. |
| contact/page.tsx:203 | "Greater Ottawa area" | No street address anywhere on the site. |
| `src/lib/business.ts:10-13` | `[LEGAL NAME TBC]`, `[STREET ADDRESS]`, `[PHONE]`, `[EMAIL]` | Printed on invoices, statements, reports. Set `BUSINESS_*` env vars; the admin area now shows a banner until they are set. |
| L:97-113 | Footer "Subscribe" newsletter | Has no backend (see REPORT, owner decision 1). |

## Invented statistics and customer proof

| Where | Text |
|---|---|
| H:187-189, about/page.tsx:26-29 | "1,500+ SKUs in stock", "6 days/wk", "Same-day account review" |
| H:61-63 | "42 cases of vine tomatoes", "Picked yesterday · Local farm" (the "This morning's load" card) |
| H:207-210, 269 | Hero mockup prices `$28.40`, `$22.95`, `$32.75`, `$19.10`, cart total `$1,284.20`, "Tier B", "Contract" |
| H:226-228, 265 | "Cedar Pizza Co.", "Tier B · Net-30 · West-side delivery", "Tomorrow · 6–9am" |
| H:315-326 | Logo cloud: Cedar Pizza Co., Harvest & Hearth, Maple Lane Café, Olive Branch Bistro, The Standard Kitchen, Driftwood Catering; "Trusted by independent kitchens across the region" |
| H:559-575 | Testimonials: Maria Salinas (Cedar Pizza Co.), James Park (Harvest & Hearth), Lena Okafor (Maple Lane Café). One says "in two years with Olleik", which also implies tenure. |
| H:644-650 | Comparison table "Olleik vs big distributors" (account manager, low minimums, six-day delivery, net-30, same-day review) with no evidence |
| about/page.tsx:60-69, H:401 | Founding story, "twenty years ago", "our own trucks ... six days a week" (no founder, year or team named) |

## Unverified operating claims (confirm or reword)

Same-day account review / "within 24 hours" / "24–48 hours" (L:21, H:515,820, about:133, apply/page.tsx:33-35, faq:20);
"$250 minimum per delivery" (H:738, faq:33); "net-30 after the first month, subject to credit approval" (H:742, faq:41);
"match or beat" price promise (H:746, faq:24); "same-day credit" for problem deliveries (H:94, delivery:24, faq:62);
refrigerated trucks and dock temperature logs (H:89-90, delivery:35); own trucks and drivers, no third-party courier
(delivery:5-31); delivery Monday to Saturday across the Ottawa region (delivery:38-39,139-144, faq:54); response times
("one business day", contact:65-66, H:754, faq:45, catalog:102); sourcing "directly from regional farms ... halal & specialty"
(H:76-79, `src/lib/catalog.ts` blurbs); a dedicated account manager (H:375, apply:14); "Crafted by Zenith AI" credit (L:174);
application spend brackets (`apply/apply-form.tsx:20-23`); `readMins` on the three starter articles in `src/lib/resources.ts`
(they are generic and flagged in that file as starter content).

## Stock photography presented as the business's own

`images.unsplash.com` photos: home "From the source" (H:48) and the category covers in `src/lib/catalog.ts:38-73`
(produce, meat, dairy, dry goods, beverages). Licence is Unsplash's; replace with real photography when available.

## Dead or fragile links

- Footer newsletter form: no action, no handler.
- `tel:+10000000000`.
- Home "See what we carry" goes to `/#categories`, which only exists when categories load.
- No `href="#"` links and no social links exist.
