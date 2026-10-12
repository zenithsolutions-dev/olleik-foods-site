"""Writes narration/FULL.json, the script of the full-system film (feat/videos-full). All copy is Pending Review.
Rules (owner brief): calm professional English, short sentences, linking phrases between the two sides, no marketing
claims, no delivery-time promises, no spoken prices; "Olleik" is spelled "Oh-lake" in the spoken text only.
usage: python narration/make_full.py"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
L = [
    # (id, chapter, spoken text, on-screen caption)
    ("f00", 0, "This film follows one restaurant through the whole Olleik system, from its first visit to its invoices.", "One restaurant, through the whole Olleik system"),
    ("f01", 1, "On the left is what a visitor or customer sees on a phone. On the right is the Olleik admin, on a desktop.", "Left: the customer's phone. Right: the admin"),
    ("f02", 1, "When something on one side causes a change on the other, a line of light links the two. The categories on the public site come straight from the admin's category list.", "Public categories come from the admin's list"),
    ("f02b", 1, "The public catalog page shows the same categories, each with its own page of products.", "The public catalog shows the same categories"),
    ("f03", 1, "Each category page lists the products the admin keeps active, with their photos. Prices stay private until a customer signs in.", "Active products with photos, no public prices"),
    ("f04", 2, "A restaurant owner wants to buy from Olleik. On the home page, they tap Become a customer.", "A restaurant owner taps Become a customer"),
    ("f05", 2, "They fill in the application: business name, contact, email, phone and address.", "The application form"),
    ("f06", 2, "They add the type of business and a short note, and submit. Now watch the admin side. The application appears on the Leads page, marked new.", "The application arrives in Leads, marked new"),
    ("f07", 2, "The phone confirms that the application was received. The dashboard also lists it under Recent leads.", "Also listed under Recent leads"),
    ("f07b", 2, "On the Leads page, tabs sort the applications by status: new, contacted, approved and rejected.", "Leads are sorted by status"),
    ("f08", 2, "The site also has a contact form and a supplier form. Those messages are saved, but the admin does not show them yet.", "Contact and supplier forms: saved, not shown in the admin"),
    ("f08b", 2, "The site also has pages about the company, delivery and common questions.", "About, delivery and questions pages"),
    ("f09", 3, "On the Leads page, the admin reviews the application and marks it approved.", "The admin marks the lead approved"),
    ("f10", 3, "Approved leads wait on the Add a customer page. One click converts the lead into a customer account.", "Convert the approved lead into a customer"),
    ("f10b", 3, "An account can also be created by hand, under Manual entry, for a customer who did not apply online.", "Manual entry for customers who did not apply online"),
    ("f11", 3, "The new account opens with a setup checklist. It is not invited yet, and it has no products.", "A setup checklist for the new account"),
    ("f12", 3, "The admin can send an invitation by email, or copy a one-time link to send by message. The customer opens it and sees a welcome page with their business name.", "An invitation opens a welcome page"),
    ("f13", 3, "They choose a password and save it. They are now signed in to their own portal, and on the admin side the account shows as active.", "Signed in: the account is now active"),
    ("f13b", 3, "The welcome banner appears only on this first visit to the portal.", "A welcome banner on the first visit"),
    ("f14", 3, "Their catalog is still empty. Nothing is visible until the admin sets it up.", "The catalog is empty until the admin sets it up"),
    ("f15", 4, "The admin opens Add product and picks the items this restaurant buys.", "The admin picks this customer's products"),
    ("f16", 4, "As soon as they are added, the customer's catalog fills up. Each product shows a price marked Your price.", "The catalog fills up, each price marked Your price"),
    ("f17", 4, "Each price comes from the margin rules. The table shows the cost, the list price, the customer's price, the profit, and the rule behind it.", "Cost, list price, customer price, profit and rule"),
    ("f18", 4, "The admin can also type a price by hand. The customer sees the new price in their catalog.", "A price typed by hand reaches the customer"),
    ("f19", 4, "A margin for this customer reprices every product that follows the rules. Prices typed by hand stay as they are.", "A customer margin reprices the computed prices"),
    ("f20", 4, "Catalog visibility can open whole categories. The extra products show at the list price, without the Your price label.", "Visibility opens whole categories at list price"),
    ("f21", 4, "A hidden product disappears from this customer's catalog, even when it is assigned.", "A hidden product disappears for this customer"),
    ("f22", 4, "Assign products does the same for many customers at once, with a preview of cost and profit before anything changes.", "Assign many products to many customers"),
    ("f23", 4, "The Margin rules page holds the global, product, category and customer margins. A new rule updates the affected customer prices automatically.", "A new margin rule updates prices automatically"),
    ("f24", 4, "From the customer page, the admin can also recompute prices, change many prices at once, copy a catalog from another customer, or export it.", "Recompute, bulk prices, copy a catalog, export"),
    ("f25", 5, "Offers are set per customer. Here the admin creates a welcome offer on salmon, for two weeks.", "The admin creates an offer for this customer"),
    ("f26", 5, "The offer appears right away on the customer's Offers page.", "It appears on the customer's Offers page"),
    ("f27", 5, "In the catalog, the salmon now shows the offer price, with the regular price struck through.", "The catalog shows the offer price"),
    ("f28", 5, "An offer template can be applied to many customers in one step. The preview shows exactly what will change, and the customer sees the new offer.", "A template applied to many customers at once"),
    ("f29", 5, "Running now lists the active offers and each applied batch, which can be undone as a whole.", "Running offers, and batches that can be undone"),
    ("f29b", 5, "Templates are reusable offers, such as a weekend promotion, kept in the Offer library.", "Templates are reusable offers"),
    ("f30", 6, "The customer searches the catalog and adds salmon to the cart.", "The customer searches and adds to the cart"),
    ("f31", 6, "They add cream, takeout cups and oat milk, choosing the quantities as they go.", "Choosing quantities"),
    ("f32", 6, "The cart shows the exact price of each line, including the offer.", "The cart shows the exact prices"),
    ("f33", 6, "At checkout they choose delivery or pickup, and can leave a note. There is no online payment. The order follows the account's payment terms.", "Delivery or pickup, a note, no online payment"),
    ("f34", 6, "They submit the order. Now watch the admin side. It appears at once in the New tab, with a number in the sidebar and an alert sound.", "The order appears in New at once"),
    ("f35", 6, "On the phone, the order shows as Received. The dashboard counts it as waiting for confirmation.", "Received, and waiting for confirmation"),
    ("f36", 7, "The admin opens the order. Each line shows its cost and profit, which the customer never sees.", "Cost and profit, for the admin only"),
    ("f36b", 7, "The order also shows who placed it, with the note left at checkout.", "The customer and the checkout note"),
    ("f37", 7, "When the admin confirms, the system checks the stock. There are not enough takeout cups.", "The stock check finds a shortage"),
    ("f38", 7, "The admin confirms anyway. The stock is taken out, and on the customer's phone the order is now Confirmed.", "Confirmed on both sides"),
    ("f39", 7, "The cups are now unavailable to every customer. The oat milk came from an open category, so it is now part of this customer's catalog.", "Cups unavailable, oat milk added to the catalog"),
    ("f40", 7, "When the order is packed, the admin marks it prepared. The customer sees Ready.", "Prepared for the admin, Ready for the customer"),
    ("f41", 7, "Once it is handed over, the admin completes it, and the customer sees Completed.", "Completed on both sides"),
    ("f41b", 7, "The customer's order page always shows the current status, and refreshes on its own.", "The order page keeps itself up to date"),
    ("f42", 7, "A second order can be cancelled, with a reason that stays with the admin. The customer sees Cancelled, and any stock taken for it goes back.", "A cancelled order, on both sides"),
    ("f43", 7, "Both sides keep the full order history, and the admin lists can be filtered by date.", "Order history, filtered by date"),
    ("f44", 8, "Each order has an invoice. Both sides print the same document, with the business details at the top.", "The same invoice on both sides"),
    ("f45", 8, "The customer's statement for a period matches the admin's customer copy.", "The statement matches the customer copy"),
    ("f45b", 8, "A statement can be printed for any period, using the period filter at the top.", "Statements for any period"),
    ("f46", 8, "The admin also has an internal copy, with cost and profit, clearly marked as internal.", "An internal copy with cost and profit"),
    ("f47", 8, "A cancelled order keeps its invoice, marked as cancelled, for the record.", "A cancelled invoice is kept for the record"),
    ("f48", 9, "Back on the admin side, confirming the order reduced the stock. The cups now show as oversold.", "The order reduced the stock"),
    ("f48b", 9, "The dashboard also lists today's top products and top customers, with links to the full analytics.", "Top products and customers"),
    ("f49", 9, "The dashboard shows today's revenue and profit, and flags the low stock.", "Today's revenue, profit and low stock"),
    ("f49b", 9, "The dashboard also flags customers who were invited but have not signed in yet, so the team can follow up.", "Invited customers who have not signed in"),
    ("f50", 9, "The low-stock and unavailable statements list what needs reordering.", "Low-stock and unavailable statements"),
    ("f50b", 9, "On the Products page, low and oversold stock is flagged in the stock column.", "Stock flags on the Products page"),
    ("f51", 9, "When new stock arrives, the admin receives it. It settles the oversold units first, and the cups are available again for customers.", "Received stock makes the cups available again"),
    ("f52", 9, "Analytics shows the revenue trend, best sellers, top customers, and customers who have gone quiet.", "Analytics: trend, best sellers, customers"),
    ("f52b", 9, "Further down, analytics shows the best sellers by units, revenue and profit, and the products that are not moving.", "Best sellers and slow movers"),
    ("f53", 9, "The report builder prints a summary for any period. Adding cost and profit turns it into an internal report.", "Reports for any period"),
    ("f54", 9, "The product list can be printed for customers, or with cost columns for internal use.", "The printable product list"),
    ("f55", 10, "The admin adds a new product, with its photo, cost, price and starting stock.", "A new product with its photo"),
    ("f56", 10, "Once it is created, it appears on the public site, still without a price.", "It appears on the public site"),
    ("f57", 10, "When a product is set to inactive, it leaves the public site.", "An inactive product leaves the public site"),
    ("f58", 10, "It also leaves every customer's catalog.", "And every customer's catalog"),
    ("f59", 10, "Categories can have one level of subcategories, which customers see in their catalog filter.", "Categories and subcategories"),
    ("f60", 11, "When the admin edits the account, the customer's Account page shows the new details.", "Account changes reach the customer"),
    ("f61", 11, "If the account is suspended, the customer can no longer open the portal.", "A suspended account is locked out"),
    ("f62", 11, "Setting it back to active restores access, with the catalog and prices kept.", "Active again, catalog and prices kept"),
    ("f62b", 11, "The customer list shows every account with its status, phone, payment terms and catalog size.", "Every account in the customer list"),
    ("f63", 11, "Customers can reset their own password from the sign-in page. Admins use a separate sign-in, open only to approved emails.", "Password reset, and the admin sign-in"),
    ("f64", 11, "Finally, order alerts can be switched on, so a sound plays when a new order arrives.", "Order alerts with sound"),
    ("f65", 12, "That is the full loop, from application to invoice, on both sides of Olleik.", "From application to invoice, on both sides"),
]
lines = []
for i, ch, t, c in L:
    assert not c.rstrip().endswith("."), c
    d = {"id": i, "chapter": ch, "text": t}
    if "Olleik" in t:
        d["speak"] = t.replace("Olleik", "Oh-lake")
    d["targetSeconds"] = round(len(t.split()) / 2.5, 1)
    d["caption"] = c
    lines.append(d)
doc = {
    "title": "Olleik Foods: the whole system, visitor, customer and admin",
    "status": "Pending Review",
    "voice": {"engine": "Higgsfield seed_audio", "voice_id": "3c9d6053-6334-592c-8997-4e325286af3f", "voice_type": "preset", "name": "Holden (owner's choice)"},
    "pronunciation": "\"Olleik\" is written \"Oh-lake\" in the spoken text only; on screen it stays \"Olleik\"",
    "rules": "calm, short sentences; no marketing claims, no delivery-time promises, no spoken prices",
    "lines": lines,
}
json.dump(doc, open(f"{HERE}/FULL.json", "w", encoding="utf8"), indent=1, ensure_ascii=False)
print(len(lines), "lines,", sum(len(l["text"].split()) for l in lines), "words, longest caption", max(len(l["caption"]) for l in lines))
