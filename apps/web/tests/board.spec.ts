import { expect, test } from "@playwright/test";
type Application = {
  id: string;
  position: string;
  status: string;
  company: { name: string };
  location: string | null;
  jobUrl: string | null;
};

test("creates, moves across all stages, and reloads applications", async ({
  page,
}) => {
  const applications: Application[] = [];
  await page.route("**/api/applications**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const data = request.postDataJSON();
      applications.push({
        ...data,
        id: "demo-id",
        createdAt: "2026-09-15T12:00:00.000Z",
        resumes: [],
        company: { name: data.companyName },
      });
      await route.fulfill({ status: 201, json: applications[0] });
    } else if (request.method() === "PATCH") {
      applications[0] = { ...applications[0], ...request.postDataJSON() };
      await route.fulfill({ json: applications[0] });
    } else {
      await route.fulfill({ json: applications });
    }
  });
  await page.goto("/");
  await expect(
    page.getByText("Your next chapter starts here.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ New application" }).click();
  await page.getByLabel("Company", { exact: true }).fill("Acme");
  await page.getByLabel("Position", { exact: true }).fill("Engineer");
  await page.getByRole("button", { name: "Save without resume" }).click();
  await expect(
    page
      .getByRole("region", { name: "Wishlist", exact: true })
      .getByRole("heading", { name: "Engineer" }),
  ).toBeVisible();
  for (const [status, name] of [
    ["APPLIED", "Applied"],
    ["SCREENING", "Screening"],
    ["TECHNICAL_INTERVIEW", "Technical interview"],
    ["FINAL_INTERVIEW", "Final interview"],
    ["OFFER", "Offer"],
    ["REJECTED", "Rejected"],
    ["WITHDRAWN", "Withdrawn"],
    ["WISHLIST", "Wishlist"],
  ]) {
    await page.getByLabel("Stage for Engineer at Acme").selectOption(status);
    await expect(
      page
        .getByRole("region", { name, exact: true })
        .getByRole("heading", { name: "Engineer" }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole("heading", { name: "Engineer" })).toBeVisible();
});

test("retains input and card status when mutations fail", async ({ page }) => {
  await page.route("**/api/applications**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 500, json: { message: "Please retry" } });
    } else {
      await route.fulfill({
        json: [
          {
            id: "demo",
            company: { name: "Acme" },
            position: "Engineer",
            status: "APPLIED",
          },
        ],
      });
    }
  });
  await page.goto("/");
  await page.getByRole("button", { name: "+ New application" }).click();
  await page.getByLabel("Company", { exact: true }).fill("Example");
  await page.getByLabel("Position", { exact: true }).fill("Designer");
  await page.getByRole("button", { name: "Save without resume" }).click();
  await expect(page.getByRole("alert")).toHaveText("Please retry");
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Example",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByLabel("Stage for Engineer at Acme").selectOption("OFFER");
  await expect(page.getByRole("alert")).toHaveText("Please retry");
  await expect(page.getByLabel("Stage for Engineer at Acme")).toHaveValue(
    "APPLIED",
  );
});

test("retries a failed initial load", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/applications", (route) => {
    attempts++;
    return route.fulfill(
      attempts === 1
        ? { status: 503, json: { message: "Unavailable" } }
        : { json: [] },
    );
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Unavailable");
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(
    page.getByText("Your next chapter starts here.", { exact: false }),
  ).toBeVisible();
});
