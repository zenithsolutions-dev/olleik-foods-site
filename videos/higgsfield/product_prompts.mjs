// Product photo set for the LOCAL video demo stack (Higgsfield, nano_banana_pro, 4:3, 2k). One style guide for all 30.
export const STYLE = `[COMPOSITION]
Camera at a 3/4 high angle, about 35 degrees above the surface, the product centred and filling about 60 percent of the frame with an even margin on all sides, 4:3 frame. The product sits on a seamless sweep of warm off-white handmade paper with a very subtle fibre texture that curves softly up into the background; no visible horizon line, no studio equipment visible.

[LIGHTING]
One large soft overhead light slightly behind and to the left of the product, about 4500K, a white fill card front right; a soft natural contact shadow under the product falling forward right; gentle falloff toward the back of the sweep.

[LENS & CAMERA]
Shot on a 100mm lens, aperture f/8, the whole product sharp, the sweep softly even behind it.

[MATERIALS & TEXTURE]
Honest real food-service ingredients and supplies with true textures: moisture, skins, fibres, grain and crumb visible, nothing glossy-fake.

[COLOR PALETTE]
Natural product colours against warm paper white, oat and soft cream tones; low-contrast warm grade, no colour cast.

[STYLE]
Quiet modern commercial still-life catalog photography, crisp natural light, honest materials, calm negative space. Every photo in this catalog set uses this exact same backdrop, angle, lens, light and grade.

[AVOID]
no text, no words, no letters, no numbers, no labels with writing, no brand marks, no logos, no stickers, no barcodes, all packaging plain and unprinted; no hands, no people; no extra props beyond those described; no AI artifacts, no plastic look, no waxy surface, no cartoonish rendering, no melted geometry, no doubled subjects, no oversaturated HDR, no halos, no oversharpening, no harsh flash, no studio equipment, no softbox, no reflector card, no watermark.

resolution: 2k`;

export const PRODUCTS = [
  ["PRD-001", "Vine-Ripe Tomatoes", "a cluster of six ripe red tomatoes still attached to a fresh green vine, two loose tomatoes beside it"],
  ["PRD-002", "Yellow Onions", "a small pile of whole yellow onions with papery golden-brown skins, one onion halved showing its pale rings"],
  ["PRD-003", "Romaine Hearts", "three crisp romaine lettuce hearts lying side by side, pale green to white at the base, fresh and dewy"],
  ["PRD-004", "Lemons", "a loose heap of bright yellow lemons with dimpled skins and a few green leaves, one lemon halved"],
  ["PRD-005", "Fresh Basil", "a generous bunch of fresh sweet basil with large glossy green leaves and stems"],
  ["PRD-006", "Russet Potatoes", "russet potatoes with earthy brown skins spilling from an open plain undyed burlap sack"],
  ["DRY-101", "Aged Cheddar Block", "a large block of aged pale-orange cheddar cheese on a small worn wooden board, one corner cut away showing crumbly texture"],
  ["DRY-102", "Whole Milk Mozzarella, Shredded", "a shallow white ceramic bowl heaped with fluffy shredded mozzarella, a few strands on the paper"],
  ["DRY-103", "Large Eggs, Grade A", "large brown eggs sitting in a plain grey moulded pulp egg tray, two eggs set on the paper in front"],
  ["DRY-104", "Unsalted Butter", "two blocks of pale yellow butter, one wrapped in plain unprinted parchment, one unwrapped with a few thick slices cut"],
  ["DRY-105", "Heavy Cream 36%", "a small clear glass jug of thick fresh cream beside a plain white unprinted one-litre carton"],
  ["MEAT-201", "Boneless Chicken Breast", "three raw boneless skinless chicken breasts, pale pink and fresh, on a sheet of plain white butcher paper"],
  ["MEAT-202", "Ground Beef 80/20", "a neat mound of fresh coarse-ground raw beef with visible fat flecks on plain white butcher paper"],
  ["MEAT-203", "Beef Burger Patties 6 oz", "a short stack of thick raw round beef burger patties separated by small squares of wax paper, one patty in front"],
  ["MEAT-204", "Chicken Wings, Split", "raw split chicken wings, flats and drumettes, arranged loosely on plain white butcher paper"],
  ["SEA-301", "Frozen Shrimp 21-25 ct", "raw shell-on grey-blue shrimp with a light frost, piled in a shallow stainless steel tray with a few crushed ice pieces"],
  ["SEA-302", "Atlantic Salmon Fillet", "a fresh skin-on side of Atlantic salmon fillet, bright coral with fine white fat lines, on plain parchment"],
  ["DRY-401", "Extra Virgin Olive Oil", "a plain unlabelled dark green glass bottle of olive oil and a small shallow dish of golden-green oil"],
  ["DRY-402", "All-Purpose Flour", "a plain unprinted white paper flour sack with its top rolled open, a steel scoop of flour in front and a light dusting of flour on the paper"],
  ["DRY-403", "Crushed San Marzano Tomatoes", "a large open plain unlabelled steel food-service can filled with crushed red tomatoes, a small bowl of crushed tomatoes beside it"],
  ["DRY-404", "Long Grain Rice", "an open plain undyed cotton sack of long-grain white rice with a wooden scoop of rice resting in front"],
  ["DRY-405", "Canola Fry Oil", "a plain unlabelled clear plastic jug of light golden cooking oil with a plain white cap, a small glass of oil beside it"],
  ["BEV-501", "Whole Bean Coffee, Medium Roast", "a plain unprinted kraft paper coffee bag, open, with medium-roast whole coffee beans spilling onto the paper"],
  ["BEV-502", "Oat Barista Milk", "two plain white unprinted one-litre cartons and a short clear glass of creamy oat milk"],
  ["FRZ-601", "Shoestring French Fries", "a heap of frozen pale thin shoestring potato fries with a light frost, in a shallow stainless steel pan"],
  ["FRZ-602", "Brioche Burger Buns", "a row of four glossy golden brioche burger buns, one split open showing soft crumb"],
  ["PKG-701", "Pizza Boxes 12\"", "a neat stack of plain unprinted brown corrugated kraft pizza boxes, the top box open and empty"],
  ["PKG-702", "Burger Clamshell, Compostable", "three plain unprinted off-white moulded plant-fibre burger clamshell containers, one open and empty"],
  ["PKG-703", "Hot Cups 12 oz", "a stack of plain white unprinted paper hot cups with plain white lids, one cup standing with its lid on"],
  ["PKG-704", "Kraft Takeout Bags", "plain unprinted brown kraft paper takeout bags with flat paper handles, one standing open, two folded flat"],
];

export const prompt = (desc, withRef) =>
  (withRef
    ? `Use the reference photo ONLY for its backdrop, camera angle, lens, lighting, shadow direction and colour grade; do not include its subject. `
    : "") + `[SUBJECT]\nCatalog photograph of ${desc}.\n\n${STYLE}`;
