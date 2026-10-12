import { test, expect } from "./helpers/fixtures";
import { select, del } from "./helpers/db";

// V-04..V-07: the three public forms and the footer newsletter box. Valid and invalid input.

const stamp = () => `QA ${Date.now()}`;

test.describe("apply form (/apply)", () => {
  test("V-04 valid application is stored as a lead and thanks the visitor", async ({ page }) => {
    const biz = stamp();
    await page.goto("/apply");
    await page.getByLabel(/Business name/).fill(biz);
    await page.getByLabel(/Contact name/).fill("Quinn Tester");
    await page.getByLabel(/^Email/).fill("qa-apply@olleik-demo.test");
    await page.getByLabel(/^Phone/).fill("(613) 555-0100");
    await page.getByLabel(/Business address/).fill("1 Test Street, Ottawa");
    await page.locator("textarea[name=notes]").fill('<script>alert(1)</script> Need produce twice a week & "quotes"');
    await page.getByRole("button", { name: /submit|apply|send/i }).click();
    await expect(page.getByText(/your application is in/i)).toBeVisible();
    const rows = await select<{ business_name: string; message: string; status: string }>(`leads?select=business_name,message,status&business_name=eq.${encodeURIComponent(biz)}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toContain("<script>alert(1)</script>"); // kept as inert text
    expect(rows[0].status).toBe("new");
    await del("leads", `business_name=eq.${encodeURIComponent(biz)}`);
  });

  test("V-04 required fields are enforced by the browser", async ({ page }) => {
    await page.goto("/apply");
    await page.getByRole("button", { name: /submit|apply|send/i }).click();
    expect(await page.getByLabel(/Business name/).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/apply");
  });

  test("V-04 an email without @ is refused and nothing is stored", async ({ page }) => {
    await page.goto("/apply");
    await page.getByLabel(/Business name/).fill(stamp());
    await page.getByLabel(/Contact name/).fill("Quinn Tester");
    await page.getByLabel(/^Email/).fill("not-an-email");
    await page.getByLabel(/^Phone/).fill("(613) 555-0100");
    await page.getByRole("button", { name: /submit|apply|send/i }).click();
    expect(await page.getByLabel(/^Email/).evaluate((e: HTMLInputElement) => e.validity.typeMismatch)).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/apply");
    expect(await select(`leads?select=id&email=eq.not-an-email`)).toHaveLength(0);
  });

  test("V-04 a very long note is accepted without breaking the page", async ({ page }) => {
    const biz = stamp();
    await page.goto("/apply");
    await page.getByLabel(/Business name/).fill(biz);
    await page.getByLabel(/Contact name/).fill("Quinn Tester");
    await page.getByLabel(/^Email/).fill("qa-long@olleik-demo.test");
    await page.getByLabel(/^Phone/).fill("(613) 555-0100");
    await page.locator("textarea[name=notes]").fill("long note ".repeat(2000));
    await page.getByRole("button", { name: /submit|apply|send/i }).click();
    await expect(page.getByText(/your application is in|couldn.t submit/i)).toBeVisible();
    await del("leads", `business_name=eq.${encodeURIComponent(biz)}`);
  });
});

test.describe("contact form (/contact)", () => {
  test("V-05 valid message is stored and thanks the visitor", async ({ page }) => {
    const name = stamp();
    await page.goto("/contact");
    await page.getByLabel("Name", { exact: false }).first().fill(name);
    await page.getByLabel(/^Email/).fill("qa-contact@olleik-demo.test");
    await page.getByLabel(/^Business/).fill("QA Bistro");
    await page.locator("textarea[name=message]").fill("Do you deliver to Kanata on Mondays?");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page).toHaveURL(/sent=1/);
    await expect(page.getByText(/thank|message is on its way|we.ve got/i).first()).toBeVisible();
    const rows = await select<{ topic: string; message: string }>(`contact_messages?select=topic,message&name=eq.${encodeURIComponent(name)}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].topic).toBe("New account");
    await del("contact_messages", `name=eq.${encodeURIComponent(name)}`);
  });

  test("V-05 required name and email are enforced by the browser", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: /send/i }).click();
    expect(await page.getByLabel(/^Email/).evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/contact");
  });
});

test.describe("supplier form (/suppliers)", () => {
  test("V-06 valid submission is stored", async ({ page }) => {
    const company = stamp();
    await page.goto("/suppliers");
    await page.locator("input[name=company]").fill(company);
    await page.locator("input[name=contact]").fill("Quinn Tester");
    await page.locator("input[name=email]").fill("qa-vendor@olleik-demo.test");
    await page.locator("input[name=phone]").fill("(613) 555-0100");
    await page.locator("textarea[name=about]").fill("Local greenhouse tomatoes.");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page).toHaveURL(/sent=1/);
    await expect(page.getByText(/we.ve got your submission/i)).toBeVisible();
    expect(await select(`vendor_submissions?select=id&company=eq.${encodeURIComponent(company)}`)).toHaveLength(1);
    await del("vendor_submissions", `company=eq.${encodeURIComponent(company)}`);
  });

  test("V-06 required fields are enforced by the browser", async ({ page }) => {
    await page.goto("/suppliers");
    await page.getByRole("button", { name: /submit/i }).click();
    expect(await page.locator("input[name=company]").evaluate((e: HTMLInputElement) => e.validity.valueMissing)).toBe(true);
  });
});

test.describe("footer newsletter box", () => {
  // KNOWN ISSUE, needs an owner decision (see REPORT.md "Needs owner decision" #1): the <form> has no action or
  // handler. Submitting reloads the page with the visitor's email in the URL and tells them nothing.
  test("V-07 subscribing does something visible (confirmation or stored address), not a silent page reload", async ({ page }) => {
    test.fixme(true, "newsletter box has no backend: owner must choose a provider or remove it (REPORT.md)");
    await page.goto("/about");
    const box = page.getByRole("form", { name: /stay in the loop/i });
    await box.getByRole("textbox").fill("qa-news@olleik-demo.test");
    await box.getByRole("button", { name: /subscribe/i }).click();
    await page.waitForLoadState("networkidle");
    const confirmed = await page.getByText(/thank|subscribed|you.re on the list/i).count();
    const reloadedWithQuery = page.url().includes("newsletter=");
    expect(confirmed > 0 && !reloadedWithQuery, `confirmation shown: ${confirmed > 0}; page reloaded with the email in the URL: ${reloadedWithQuery} (${page.url()})`).toBe(true);
  });
});
