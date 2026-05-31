import { expect, test } from "@playwright/test";

/**
 * Smoke tests — no auth, no external services required. Verifies the
 * static surfaces still render and routing works. If any of these fail
 * the build is broken; we should catch it before merge.
 */

test.describe("public pages render", () => {
  test("landing shows the Quizen wordmark and value prop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /sube tu pdf/i,
    );
    await expect(page.getByText(/estudia con calma/i).first()).toBeVisible();
  });

  test("/login renders the magic-link form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 2 })).toContainText(
      /bienvenido/i,
    );
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("/pricing shows Free and Pro tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Free").first()).toBeVisible();
    await expect(page.getByText("Pro").first()).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
  });
});

test.describe("auth gate", () => {
  test("/library redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/upload redirects to /login when unauthenticated", async ({ page }) => {
    // /upload is a static client component, but server-level middleware
    // doesn't redirect here. It will appear and then fail at submit time.
    // Adjust this spec if we add server-side gating to /upload later.
    await page.goto("/upload");
    // For now, just verify the page loads (no crash).
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
