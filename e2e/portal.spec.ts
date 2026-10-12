import { test, expect, authFile, pageProblems } from "./helpers/fixtures";
import { select, patch } from "./helpers/db";
import { customerByKey, productBySku, setOffers, createOrder } from "./helpers/data";
import type { Page } from "@playwright/test";

// C-02..C-10: the customer portal. Copperleaf Kitchen (net-30) is the shopper.
test.use({ storageState: authFile("copperleaf") });

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function assignedPrice(sku: string) {
  const c = await customerByKey("copperleaf");
  const p = await productBySku(sku);
  const r = await select<{ price_cents: number | null }>(`customer_products?select=price_cents&customer_id=eq.${c.id}&product_id=eq.${p.id}`);
  return { base: r[0].price_cents ?? p.list_price_cents, product: p, customerId: c.id };
}

/** Put products in the browser cart exactly as the app stores it (localStorage), before the first navigation. */
async function seedCart(page: Page, lines: { sku: string; qty: number }[]) {
  const prods = await Promise.all(lines.map((l) => productBySku(l.sku)));
  const payload = { token: "7b1f3c52-7d0e-4c6e-9d57-0c3a8f6a1e11", lines: lines.map((l, i) => ({ productId: prods[i].id, qty: l.qty })) };
  await page.addInitScript((p) => {
    if (!window.localStorage.getItem("olleik-cart-v1")) window.localStorage.setItem("olleik-cart-v1", JSON.stringify(p));
  }, payload);
}

const cartLine = (page: Page, name: string | RegExp) => page.getByTestId("cart-line").filter({ hasText: name });

test.beforeEach(async () => {
  await setOffers("copperleaf", []); // tests that need offers add their own
});

test.describe("catalog", () => {
  test("C-02 shows only assigned products, with photos and 'Your price'", async ({ page }) => {
    await page.goto("/portal/catalog");
    await expect(page.getByText(/18 products available/)).toBeVisible();
    await expect(page.getByText("Aged Cheddar Block")).toBeVisible();
    await expect(page.getByText("Ground Beef 80/20")).toHaveCount(0); // assigned to Ember, not Copperleaf
    expect(await page.locator("main img").count()).toBeGreaterThan(5);
    await expect(page.getByText("Your price").first()).toBeVisible();
  });

  test("C-02 search by name, by SKU, no results, clear", async ({ page }) => {
    await page.goto("/portal/catalog");
    await page.getByLabel("Search products by name or SKU").fill("cheddar");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Aged Cheddar Block")).toBeVisible();
    await expect(page.getByText("Lemons")).toHaveCount(0);
    await page.getByLabel("Search products by name or SKU").fill("MEAT-201");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Boneless Chicken Breast")).toBeVisible();
    await page.getByLabel("Search products by name or SKU").fill("zzzz-nothing");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText(/No products match your search/)).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page.getByText(/18 products available/)).toBeVisible();
  });

  test("C-02 category filter narrows the list", async ({ page }) => {
    await page.goto("/portal/catalog");
    await page.getByLabel("Filter by category").selectOption({ label: "Seafood" });
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Atlantic Salmon Fillet")).toBeVisible();
    await expect(page.getByText("Aged Cheddar Block")).toHaveCount(0);
  });

  test("C-02 an unavailable product cannot be added and says so", async ({ page }) => {
    const p = await productBySku("PRD-006");
    await patch("products", `id=eq.${p.id}`, { is_available: false });
    try {
      await page.goto("/portal/catalog?q=Russet");
      await expect(page.getByText("Currently unavailable")).toBeVisible();
      await expect(page.getByRole("button", { name: /add to cart/i })).toHaveCount(0);
    } finally {
      await patch("products", `id=eq.${p.id}`, { is_available: true });
    }
  });
});

test.describe("cart", () => {
  test("C-03 add from the catalog, quantity stepper, count badge and persistence across reload", async ({ page, isMobile }) => {
    await page.goto("/portal/catalog?q=Cheddar");
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByText("1 in cart")).toBeVisible();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.getByText("2 in cart")).toBeVisible();
    const badge = isMobile ? page.locator("header").getByRole("link", { name: /cart/i }) : page.locator("nav").getByRole("link", { name: /cart/i });
    await expect(badge).toContainText("2");
    await page.reload();
    await expect(page.getByText("2 in cart")).toBeVisible();
    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible(); // back to 0
  });

  test("C-04 totals are the sum of the lines at the customer's prices; qty edits and remove work", async ({ page }) => {
    const a = await assignedPrice("DRY-101");
    const b = await assignedPrice("PRD-001");
    await seedCart(page, [{ sku: "DRY-101", qty: 2 }, { sku: "PRD-001", qty: 3 }]);
    await page.goto("/portal/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await expect(page.getByText(money(2 * a.base + 3 * b.base)).last()).toBeVisible();
    await expect(page.getByText("Total (5 units)")).toBeVisible();
    await page.getByRole("button", { name: "Increase Aged Cheddar Block" }).click();
    await expect(page.getByText(money(3 * a.base + 3 * b.base)).last()).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Decrease Vine-Ripe Tomatoes" }).click(); // qty 0 removes the line
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await page.getByRole("button", { name: "Remove Aged Cheddar Block" }).click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse your catalog/ })).toBeVisible();
  });

  test("C-04 two quick taps on + are two changes (regression: the second tap used a stale quantity)", async ({ page }) => {
    const a = await assignedPrice("DRY-101");
    await seedCart(page, [{ sku: "DRY-101", qty: 1 }]);
    await page.goto("/portal/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    const plus = page.getByRole("button", { name: "Increase Aged Cheddar Block" });
    await plus.dblclick();
    await plus.click();
    await expect(page.getByText(money(4 * a.base)).last()).toBeVisible();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("olleik-cart-v1") ?? "{}").lines[0].qty);
    expect(stored).toBe(4);
  });

  test("C-04 product names are never truncated and every line has a picture slot (375 px and desktop)", async ({ page }) => {
    await seedCart(page, [{ sku: "DRY-403", qty: 1 }, { sku: "MEAT-201", qty: 1 }, { sku: "SEA-302", qty: 1 }, { sku: "PRD-001", qty: 1 }]);
    await page.goto("/portal/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(4);
    const problems = await page.getByTestId("cart-line").evaluateAll((lines) =>
      lines.flatMap((l) => {
        const name = l.querySelector("p.font-medium") as HTMLElement;
        const cs = getComputedStyle(name);
        const out: string[] = [];
        if (cs.textOverflow === "ellipsis") out.push(`ellipsis on "${name.innerText}"`);
        if (name.scrollWidth > name.clientWidth + 1) out.push(`clipped "${name.innerText}"`);
        if (name.getBoundingClientRect().right > document.documentElement.clientWidth) out.push(`outside viewport "${name.innerText}"`);
        if (!l.querySelector('[data-testid="product-thumb"]')) out.push(`no thumbnail slot for "${name.innerText}"`);
        return out;
      }),
    );
    expect(problems).toEqual([]);
    await expect(page.getByText("Crushed San Marzano Tomatoes")).toBeVisible(); // longest name, in full
    expect(await pageProblems(page)).toEqual([]);
  });

  test("C-04 the thumbnail shows the photo, or a same-size letter tile when there is none or it fails to load", async ({ page }) => {
    const noPhoto = await productBySku("PRD-006");
    const broken = await productBySku("PRD-004");
    const keepNo = noPhoto.image_url;
    const keepBroken = broken.image_url;
    await patch("products", `id=eq.${noPhoto.id}`, { image_url: null });
    await patch("products", `id=eq.${broken.id}`, { image_url: "http://127.0.0.1:54321/storage/v1/object/public/product-images/products/does-not-exist.jpg" });
    try {
      await seedCart(page, [{ sku: "DRY-101", qty: 1 }, { sku: "PRD-006", qty: 1 }, { sku: "PRD-004", qty: 1 }]);
      await page.goto("/portal/cart");
      await expect(page.getByTestId("cart-line")).toHaveCount(3);
      const withPhoto = cartLine(page, "Aged Cheddar Block").getByTestId("product-thumb");
      const withoutPhoto = cartLine(page, "Russet Potatoes").getByTestId("product-thumb");
      const withBroken = cartLine(page, "Lemons").getByTestId("product-thumb");
      await expect(withPhoto).toHaveAttribute("data-state", "image");
      await expect(withoutPhoto).toHaveAttribute("data-state", "fallback");
      await expect(withBroken).toHaveAttribute("data-state", "fallback", { timeout: 15_000 }); // the onError swap
      await expect(withoutPhoto).toContainText("R");
      const [a, b, c] = await Promise.all([withPhoto.boundingBox(), withoutPhoto.boundingBox(), withBroken.boundingBox()]);
      expect([a!.width, a!.height]).toEqual([b!.width, b!.height]);
      expect([a!.width, a!.height]).toEqual([c!.width, c!.height]);
      await expect(withPhoto.locator("img")).toHaveAttribute("alt", "Aged Cheddar Block");
    } finally {
      await patch("products", `id=eq.${noPhoto.id}`, { image_url: keepNo });
      await patch("products", `id=eq.${broken.id}`, { image_url: keepBroken });
    }
  });

  test("C-04 a product no longer available to the account is flagged and removable; checkout is blocked", async ({ page }) => {
    await seedCart(page, [{ sku: "DRY-101", qty: 1 }, { sku: "MEAT-202", qty: 1 }]); // Ground Beef is not assigned to Copperleaf
    await page.goto("/portal/cart");
    await expect(page.getByText(/1 item is no longer available to your account/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: /Remove it/ }).click();
    await expect(page.getByText(/no longer available/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Proceed to checkout/ })).not.toHaveAttribute("aria-disabled", "true");
  });

  test("C-04 an unavailable line blocks checkout", async ({ page }) => {
    const p = await productBySku("PRD-006");
    await patch("products", `id=eq.${p.id}`, { is_available: false });
    try {
      await seedCart(page, [{ sku: "DRY-101", qty: 1 }, { sku: "PRD-006", qty: 1 }]);
      await page.goto("/portal/cart");
      await expect(page.getByText(/currently unavailable/i).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Proceed to checkout/ })).toHaveAttribute("aria-disabled", "true");
    } finally {
      await patch("products", `id=eq.${p.id}`, { is_available: true });
    }
  });
});

test.describe("offers priced into the cart", () => {
  async function lineText(page: Page, sku: string, qty = 1) {
    await seedCart(page, [{ sku, qty }]);
    await page.goto("/portal/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    return page.getByTestId("cart-line").innerText();
  }

  test("C-05 percent off: round(base × (1 − v/100)), shown with 'was'", async ({ page }) => {
    const { base } = await assignedPrice("PRD-001");
    await setOffers("copperleaf", [{ title: "QA percent", kind: "percent", value: 12, sku: "PRD-001" }]);
    const want = Math.round(base * 0.88);
    const text = await lineText(page, "PRD-001", 3);
    expect(text).toContain(money(want));
    expect(text).toContain(`was ${money(base)}`);
    expect(text).toContain(money(3 * want));
  });

  test("C-05 amount off: base − v; an amount larger than the price clamps at $0.00", async ({ page }) => {
    const { base } = await assignedPrice("DRY-101");
    await setOffers("copperleaf", [{ title: "QA amount", kind: "amount_off", value: 300, sku: "DRY-101" }]);
    let text = await lineText(page, "DRY-101", 2);
    expect(text).toContain(money(base - 300));
    expect(text).toContain(money(2 * (base - 300)));
    await setOffers("copperleaf", [{ title: "QA huge amount", kind: "amount_off", value: base + 5000, sku: "DRY-101" }]);
    await page.goto("/portal/cart");
    text = await page.getByTestId("cart-line").innerText();
    expect(text).toContain("$0.00");
  });

  test("C-05 fixed price: charged price is the fixed price, but never above the base", async ({ page }) => {
    const { base } = await assignedPrice("MEAT-201");
    await setOffers("copperleaf", [{ title: "QA fixed", kind: "fixed_price", value: 15000, sku: "MEAT-201" }]);
    let text = await lineText(page, "MEAT-201", 2);
    expect(text).toContain(money(15000));
    expect(text).toContain(`was ${money(base)}`);
    await setOffers("copperleaf", [{ title: "QA fixed above", kind: "fixed_price", value: base + 9000, sku: "MEAT-201" }]);
    await page.goto("/portal/cart");
    text = await page.getByTestId("cart-line").innerText();
    expect(text).toContain(money(base));
    expect(text).not.toContain("was");
  });

  test("C-05 best single offer wins (never compounded); account-wide offers apply to every assigned product", async ({ page }) => {
    const { base } = await assignedPrice("DRY-104");
    await setOffers("copperleaf", [
      { title: "QA 10 percent", kind: "percent", value: 10, sku: "DRY-104" },
      { title: "QA 100 off", kind: "amount_off", value: 100, sku: "DRY-104" },
      { title: "QA account-wide 20", kind: "percent", value: 20 },
    ]);
    const best = Math.min(Math.round(base * 0.9), base - 100, Math.round(base * 0.8));
    const text = await lineText(page, "DRY-104", 1);
    expect(text).toContain(money(best));
    expect(best).toBeGreaterThan(Math.round(base * 0.9 * 0.8)); // compounding would have been lower
    expect(text).toContain("QA account-wide 20");
  });

  test("C-05 expired, scheduled and switched-off offers do not apply", async ({ page }) => {
    const { base } = await assignedPrice("PRD-003");
    const day = 86_400_000;
    await setOffers("copperleaf", [
      { title: "QA expired", kind: "percent", value: 50, sku: "PRD-003", startsAt: new Date(Date.now() - 9 * day).toISOString(), endsAt: new Date(Date.now() - 3 * day).toISOString() },
      { title: "QA scheduled", kind: "percent", value: 50, sku: "PRD-003", startsAt: new Date(Date.now() + 3 * day).toISOString() },
      { title: "QA off", kind: "percent", value: 50, sku: "PRD-003", active: false },
    ]);
    const text = await lineText(page, "PRD-003", 1);
    expect(text).toContain(money(base));
    expect(text).not.toContain("was");
  });

  test("C-10 /portal/offers lists the live offers", async ({ page }) => {
    await setOffers("copperleaf", [{ title: "QA visible offer", kind: "percent", value: 5, sku: "PRD-001" }]);
    await page.goto("/portal/offers");
    await expect(page.getByText("QA visible offer")).toBeVisible();
  });

  test("C-10 /portal/offers empty state", async ({ page }) => {
    await page.goto("/portal/offers");
    await expect(page.getByText(/no (active |current )?(offers|promotions)/i).first()).toBeVisible();
  });
});

test.describe("checkout and orders", () => {
  test("C-06 place an order: totals match, delivery + notes stored, cart cleared, one order only", async ({ page }) => {
    const a = await assignedPrice("DRY-101");
    const b = await assignedPrice("PRD-001");
    const before = await select(`orders?select=id&customer_id=eq.${a.customerId}`);
    await seedCart(page, [{ sku: "DRY-101", qty: 2 }, { sku: "PRD-001", qty: 1 }]);
    await page.goto("/portal/cart");
    const total = 2 * a.base + b.base;
    await expect(page.getByText(money(total)).last()).toBeVisible();
    await page.getByRole("link", { name: /Proceed to checkout/ }).click();
    await expect(page).toHaveURL(/\/portal\/checkout/);
    await expect(page.getByTestId("checkout-line")).toHaveCount(2);
    await expect(page.getByTestId("checkout-line").first().getByTestId("product-thumb")).toBeVisible();
    await page.getByRole("radio", { name: /Delivery/ }).check();
    await page.getByLabel(/Notes/).fill("Back door, ring twice. 100% fresh please.");
    await page.getByRole("button", { name: new RegExp(`Submit order · ${esc(money(total))}`) }).dblclick(); // must not create two orders
    await expect(page).toHaveURL(/\/portal\/orders\/[0-9a-f-]{36}\?placed=1/);
    await expect(page.getByText(/Order received/)).toBeVisible();
    await expect(page.getByTestId("order-line")).toHaveCount(2);
    await expect(page.getByText(money(total)).last()).toBeVisible();
    const after = await select<Record<string, unknown>>(
      `orders?select=id,status,fulfillment,notes,total_cents,payment_terms_snapshot&customer_id=eq.${a.customerId}&order=created_at.desc&limit=1`,
    );
    expect(await select(`orders?select=id&customer_id=eq.${a.customerId}`)).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({ status: "new", fulfillment: "delivery", total_cents: total, payment_terms_snapshot: "net-30", notes: "Back door, ring twice. 100% fresh please." });
    const ls = await page.evaluate(() => JSON.parse(localStorage.getItem("olleik-cart-v1") ?? "{}"));
    expect(ls.lines).toEqual([]);
    await page.goto("/portal/checkout");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("C-06 notes are capped at 1000 characters", async ({ page }) => {
    await seedCart(page, [{ sku: "DRY-101", qty: 1 }]);
    await page.goto("/portal/checkout");
    await page.getByLabel(/Notes/).fill("x".repeat(1500));
    expect(await page.getByLabel(/Notes/).inputValue()).toHaveLength(1000);
  });

  test("C-06 checkout with an empty cart shows the empty state", async ({ page }) => {
    await page.goto("/portal/checkout");
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("C-06 prices that changed since the cart loaded are shown fresh and need a second submit", async ({ page }) => {
    const a = await assignedPrice("DRY-101");
    await seedCart(page, [{ sku: "DRY-101", qty: 1 }]);
    await page.goto("/portal/checkout");
    await expect(page.getByTestId("checkout-line")).toHaveCount(1);
    await patch("customer_products", `customer_id=eq.${a.customerId}&product_id=eq.${a.product.id}`, { price_cents: a.base + 250 });
    try {
      await page.getByRole("button", { name: /Submit order/ }).click();
      await expect(page.getByText(/Prices changed since you loaded your cart/)).toBeVisible();
      await expect(page.getByText(money(a.base + 250)).first()).toBeVisible();
      expect(await select(`orders?select=id&customer_id=eq.${a.customerId}&total_cents=eq.${a.base}&status=eq.new`)).toHaveLength(0);
    } finally {
      await patch("customer_products", `customer_id=eq.${a.customerId}&product_id=eq.${a.product.id}`, { price_cents: a.base });
    }
  });

  test("C-07 order list and detail: Toronto time, status chip, thumbnails, totals", async ({ page }) => {
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 2 }, { sku: "PRD-001", qty: 1 }, { sku: "MEAT-201", qty: 1 }, { sku: "SEA-302", qty: 1 }], {
      status: "confirmed",
      createdAt: "2026-10-09T02:30:00Z", // 10:30 pm on Oct 8 in Toronto: must NOT read Oct 9
    });
    await page.goto("/portal/orders");
    const row = page.locator(`a[href="/portal/orders/${o.id}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText("Oct 8, 2026");
    await expect(row).toContainText("4 items");
    await expect(row.getByTestId("thumb-strip").getByTestId("product-thumb")).toHaveCount(3);
    await expect(row).toContainText("+1");
    await row.click();
    await expect(page.getByText(/Oct 8, 2026, 10:30 p\.m\./)).toBeVisible();
    await expect(page.getByTestId("order-line")).toHaveCount(4);
    await expect(page.getByText(money(o.totalCents)).last()).toBeVisible();
    expect(await pageProblems(page)).toEqual([]);
  });

  test("C-07 an empty period shows the empty state", async ({ page }) => {
    await page.goto("/portal/orders?range=custom&from=2020-01-01&to=2020-01-31");
    await expect(page.getByText(/No orders in this period/)).toBeVisible();
  });

  test("C-08 invoice and statement render", async ({ page }) => {
    const o = await createOrder("copperleaf", [{ sku: "DRY-101", qty: 1 }], { status: "completed" });
    await page.goto(`/portal/orders/${o.id}/invoice`);
    await expect(page.locator("main").getByText("Copperleaf Kitchen").first()).toBeVisible();
    await expect(page.locator("main").getByText(/Olleik Foods/).first()).toBeVisible();
    await page.goto("/portal/orders/statement");
    await expect(page.getByText(/statement/i).first()).toBeVisible();
  });

  test("C-09 account page shows the customer's own details", async ({ page }) => {
    await page.goto("/portal/account");
    await expect(page.locator("main").getByText("Copperleaf Kitchen").first()).toBeVisible();
    await expect(page.locator("main").getByText(/copperleaf@olleik-demo.test/)).toBeVisible();
  });
});
