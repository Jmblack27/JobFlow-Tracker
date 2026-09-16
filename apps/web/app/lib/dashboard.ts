import type { Application, Status } from "./applications";
const responseStages: Status[] = [
  "SCREENING",
  "TECHNICAL_INTERVIEW",
  "FINAL_INTERVIEW",
  "OFFER",
  "REJECTED",
];
export function summarizeApplications(
  applications: Pick<Application, "status">[],
) {
  return {
    total: applications.length,
    submitted: applications.filter((a) => a.status !== "WISHLIST").length,
    responses: applications.filter((a) => responseStages.includes(a.status))
      .length,
    rejected: applications.filter((a) => a.status === "REJECTED").length,
    waiting: applications.filter((a) => a.status === "APPLIED").length,
    offers: applications.filter((a) => a.status === "OFFER").length,
  };
}

export function summarizePlatforms(applications: Pick<Application, "status" | "platform">[]) {
  const groups = new Map<string, { platform: string; submitted: number; responses: number }>();
  for (const application of applications) {
    if (application.status === "WISHLIST") continue;
    const platform = application.platform?.trim().replace(/\s+/g, " ") || "Not specified";
    const key = platform.toLowerCase();
    const group = groups.get(key) || { platform, submitted: 0, responses: 0 };
    group.submitted++;
    if (responseStages.includes(application.status)) group.responses++;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({ ...group, rate: group.responses / group.submitted * 100 }))
    .sort((a, b) => b.rate - a.rate || b.responses - a.responses || b.submitted - a.submitted || a.platform.localeCompare(b.platform));
}
