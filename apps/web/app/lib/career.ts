export type Profile = {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string;
  skills: string;
  experience: string;
  projects: string;
  education: string;
  certifications: string;
  languages: string;
};
export type Evidence = { section: string; quote: string };
export type Claim = { text: string; evidence: Evidence[] };
export type ResumeContent = {
  summary: Claim;
  sections: { title: string; items: Claim[] }[];
};
export type Analysis = {
  id: string;
  createdAt: string;
  content: {
    roleSummary: string;
    matchingSkills: { requirement: string; evidence: Evidence[] }[];
    missingRequirements: string[];
    questions: string[];
  };
};
export type Resume = {
  id: string;
  content: ResumeContent;
  profileSnapshot: Profile;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};
export type Workspace = {
  application: import("./applications").Application;
  analysis: Analysis | null;
  resumes: Resume[];
  analysisCurrent: boolean;
  hasProfile: boolean;
};
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.message === "string"
        ? body.message
        : "Could not reach JobFlow. Please try again.",
    );
  }
  return response.json() as Promise<T>;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
