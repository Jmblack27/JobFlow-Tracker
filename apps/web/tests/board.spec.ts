import { expect, test } from "@playwright/test";
type Application = {
  id: string;
  position: string;
  status: string;
  company: { name: string };
  location: string | null;
  jobUrl: string | null;
  createdAt?: string;
  resumes?: unknown[];
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
      .getByRole("table", { name: "Applications", exact: true })
      .getByRole("link", { name: "Engineer", exact: true }),
  ).toBeVisible();
  for (const [status] of [
    ["APPLIED", "Applied"],
    ["APPLIED_PENDING_TEST", "Applied — technical test pending"],
    ["SCREENING", "Screening"],
    ["TECHNICAL_INTERVIEW", "Technical interview"],
    ["FINAL_INTERVIEW", "Final interview"],
    ["OFFER", "Offer"],
    ["REJECTED", "Rejected"],
    ["WITHDRAWN", "Withdrawn"],
    ["WISHLIST", "Wishlist"],
  ]) {
    await page.getByLabel("Stage for Engineer at Acme").selectOption(status);
    await expect(page.getByLabel("Stage for Engineer at Acme")).toHaveValue(
      status,
    );
  }
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Engineer", exact: true }),
  ).toBeVisible();
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

test("filters the table while dashboard totals remain global", async ({
  page,
}) => {
  await page.route("**/api/applications", (route) =>
    route.fulfill({
      json: [
        {
          id: "1",
          position: "Engineer",
          company: { name: "Acme" },
          category: "IT",
          status: "APPLIED",
          createdAt: "2026-09-15T12:00:00Z",
          resumes: [],
        },
        {
          id: "2",
          position: "Cashier",
          company: { name: "Market" },
          category: "NON_IT",
          status: "REJECTED",
          createdAt: "2026-09-14T12:00:00Z",
          resumes: [],
        },
      ],
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("article", { name: "Total opportunities", exact: true }),
  ).toContainText("2");
  await expect(
    page.getByRole("article", { name: "Responses", exact: true }),
  ).toContainText("1");
  await page.getByLabel("Job category", { exact: true }).selectOption("NON_IT");
  await expect(
    page.getByRole("link", { name: "Cashier", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Engineer", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("article", { name: "Total opportunities", exact: true }),
  ).toContainText("2");
  await page.getByLabel("Filter by stage").selectOption("APPLIED");
  await expect(
    page.getByText("No matching applications", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all applications" }).click();
  await expect(page.getByRole("table", { name: "Applications", exact: true }).getByRole("row")).toHaveCount(3);
  await page.getByLabel("Sort by").selectOption("oldest");
  await expect(page.getByRole("table", { name: "Applications", exact: true }).getByRole("row").nth(1)).toContainText(
    "Cashier",
  );
});
