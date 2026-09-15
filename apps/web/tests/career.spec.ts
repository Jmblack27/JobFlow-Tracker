import { expect, test } from "@playwright/test";

const profile = {
  fullName: "Alex Morgan",
  headline: "Engineer",
  email: "alex@example.com",
  phone: "",
  location: "Bogota",
  links: "",
  skills: "NestJS and PostgreSQL",
  experience: "Acme Engineer 2022–2024",
  projects: "",
  education: "",
  certifications: "",
  languages: "English B2",
};
const evidence = [{ section: "skills", quote: "NestJS and PostgreSQL" }];
const content = {
  summary: { text: "Engineer using NestJS and PostgreSQL.", evidence },
  sections: [
    { title: "Skills", items: [{ text: "NestJS and PostgreSQL", evidence }] },
  ],
};
const description =
  "Backend engineer using NestJS and PostgreSQL. AWS experience is required.";
const applicationId = "ed9053e4-e8d0-4fe7-bf10-cb8db149443b";
const resumeId = "4d82c2fd-e1a9-4e40-9b6d-837b6b9d022a";

test("saves and reloads a profile", async ({ page }) => {
  let saved: { content: typeof profile | null } = { content: null };
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT")
      saved = { content: route.request().postDataJSON() };
    await route.fulfill({ json: saved });
  });
  await page.goto("/profile");
  await page.getByRole("button", { name: "Set up profile" }).click();
  await page.getByLabel("Full name", { exact: true }).fill(profile.fullName);
  await page.getByLabel("Skills", { exact: false }).fill(profile.skills);
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: profile.fullName, exact: true }),
  ).toBeVisible();
});

test("prepares a prompt, imports a response, reviews and downloads PDF", async ({
  page,
}) => {
  type Resume = {
    id: string;
    content: typeof content;
    profileSnapshot: typeof profile;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  const analysis = {
    id: "analysis",
    createdAt: "2026-09-12T12:00:00.000Z",
    content: {
      roleSummary: "Backend role.",
      matchingSkills: [{ requirement: "NestJS", evidence }],
      missingRequirements: ["AWS"],
      questions: ["Have you used AWS?"],
    },
  };
  const workspace = {
    application: {
      id: applicationId,
      position: "Engineer",
      company: { name: "Acme" },
      jobDescription: "",
    },
    analysis: null as typeof analysis | null,
    resumes: [] as Resume[],
    analysisCurrent: false,
    hasProfile: true,
  };
  const paidCalls: string[] = [];
  await page.route("**/api/applications/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/analyze") || url.endsWith("/resumes")) {
      paidCalls.push(url);
      return route.fulfill({ status: 404 });
    }
    if (url.endsWith("/resume-workspace"))
      return route.fulfill({ json: workspace });
    if (url.endsWith("/description")) {
      workspace.application.jobDescription = route
        .request()
        .postDataJSON().jobDescription;
      workspace.analysisCurrent = false;
      return route.fulfill({ json: workspace.application });
    }
    if (url.endsWith("/resume-prompt"))
      return route.fulfill({
        json: {
          sourceId: "a".repeat(64),
          prompt: "Prepare an English resume using only supported experience.",
        },
      });
    if (url.endsWith("/resumes/import")) {
      if (route.request().postDataJSON().response === "incomplete") {
        return route.fulfill({
          status: 400,
          json: { message: "Copy the complete JSON block from ChatGPT." },
        });
      }
      workspace.analysis = analysis;
      workspace.analysisCurrent = true;
      workspace.resumes = [
        {
          id: resumeId,
          content,
          profileSnapshot: profile,
          reviewedAt: null,
          createdAt: "2026-09-12T12:00:00.000Z",
          updatedAt: "2026-09-12T12:00:00.000Z",
        },
      ];
      return route.fulfill({ status: 201, json: workspace.resumes[0] });
    }
    if (url.endsWith("/pdf"))
      return route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4 test",
      });
    if (route.request().method() === "PATCH") {
      const input = route.request().postDataJSON();
      workspace.resumes[0] = {
        ...workspace.resumes[0],
        content: input.content,
        reviewedAt: input.reviewed ? "2026-09-12T12:01:00.000Z" : null,
        updatedAt: "2026-09-12T12:01:00.000Z",
      };
      return route.fulfill({ json: workspace.resumes[0] });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto("/applications/" + applicationId);
  await expect(
    page.getByRole("button", { name: "Prepare prompt" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Job description", exact: true })
    .fill(description);
  await page.getByRole("button", { name: "Save description" }).click();
  await page.getByRole("button", { name: "Prepare prompt" }).click();
  await expect(page.getByLabel("Prompt to copy")).toHaveValue(
    "Prepare an English resume using only supported experience.",
  );
  await page
    .getByRole("textbox", { name: "ChatGPT response", exact: true })
    .fill("incomplete");
  await page.getByRole("button", { name: "Import resume" }).click();
  await expect(page.getByRole("alert")).toContainText("complete JSON block");
  await expect(
    page.getByRole("textbox", { name: "ChatGPT response", exact: true }),
  ).toHaveValue("incomplete");
  await page
    .getByRole("textbox", { name: "ChatGPT response", exact: true })
    .fill(
      JSON.stringify({
        sourceId: "a".repeat(64),
        analysis: analysis.content,
        resume: content,
      }),
    );
  await page.getByRole("button", { name: "Import resume" }).click();
  await expect(page.getByText("AWS", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download PDF" }),
  ).toBeDisabled();
  await page.getByLabel("Professional summary").fill("My reviewed summary.");
  await page.getByLabel("I reviewed this resume", { exact: false }).check();
  await page.getByRole("button", { name: "Save resume", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download PDF" }),
  ).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("resume.pdf");
  await page.reload();
  await expect(page.getByLabel("Professional summary")).toHaveValue(
    "My reviewed summary.",
  );
  expect(paidCalls).toEqual([]);
});

test("preserves profile input after a failed save", async ({ page }) => {
  await page.route("**/api/profile", (route) =>
    route.fulfill(
      route.request().method() === "PUT"
        ? { status: 503, json: { message: "Try again later" } }
        : { json: { content: null } },
    ),
  );
  await page.goto("/profile");
  await page.getByRole("button", { name: "Set up profile" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Alex");
  await page.getByLabel("Skills", { exact: false }).fill("NestJS");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Try again later");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex",
  );
});

test("edits one section, cancels safely and preserves other sections", async ({
  page,
}) => {
  let saved = { content: { ...profile } };
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT")
      saved = { content: route.request().postDataJSON() };
    await route.fulfill({ json: saved });
  });
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: profile.fullName, exact: true }),
  ).toBeVisible();
  const editSkills = page.getByRole("button", {
    name: "Edit skills",
    exact: true,
  });
  await editSkills.click();
  const dialog = page.getByRole("dialog", { name: "Edit skills", exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Skills", { exact: true })
    .fill("Customer service and Excel");
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Discard unsaved changes?")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(dialog.getByLabel("Skills", { exact: true })).toHaveValue(
    "Customer service and Excel",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard changes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(editSkills).toBeFocused();
  expect(saved.content.skills).toBe(profile.skills);
  await editSkills.click();
  await dialog
    .getByLabel("Skills", { exact: true })
    .fill("Customer service and Excel");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Customer service and Excel", { exact: true }),
  ).toBeVisible();
  expect(saved.content.experience).toBe(profile.experience);
  expect(saved.content.fullName).toBe(profile.fullName);
});

test("keeps section edits open after a failed save", async ({ page }) => {
  await page.route("**/api/profile", (route) =>
    route.fulfill(
      route.request().method() === "PUT"
        ? { status: 503, json: { message: "Please retry" } }
        : { json: { content: profile } },
    ),
  );
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Edit experience", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Experience", { exact: true })
    .fill("Updated experience");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText("Please retry");
  await expect(dialog.getByLabel("Experience", { exact: true })).toHaveValue(
    "Updated experience",
  );
  await expect(
    dialog.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeEnabled();
});
