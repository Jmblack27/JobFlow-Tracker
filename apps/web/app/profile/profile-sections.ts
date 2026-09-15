import type { Profile } from "../lib/career";

export const emptyProfile: Profile = {
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: "",
  skills: "",
  experience: "",
  projects: "",
  education: "",
  certifications: "",
  languages: "",
};
export const sections = [
  {
    key: "skills",
    title: "Skills",
    description: "What you bring to the role",
    help: "Add skills you have used, your level and a concrete example. These can be technical, administrative, creative or interpersonal.",
    placeholder:
      "Customer service — resolved requests by email and phone.\nExcel — maintained weekly inventory reports.",
  },
  {
    key: "experience",
    title: "Experience",
    description: "Your work and the impact you made",
    help: "For each role, include the employer, job title, dates, responsibilities and real achievements. Separate roles with a blank line.",
    placeholder:
      "Company · Job title · Dates\nWhat you did and the results you can demonstrate.",
  },
  {
    key: "projects",
    title: "Projects",
    description: "Work that shows your abilities",
    help: "Include the project name, your contribution and outcomes. Identify personal, volunteer or academic projects.",
    placeholder:
      "Project name · Personal / volunteer / academic\nYour contribution and what you accomplished.",
  },
  {
    key: "education",
    title: "Education",
    description: "Your studies and qualifications",
    help: "Add the institution, qualification, dates and completion status.",
    placeholder: "Institution · Qualification\nDates · Completed / In progress",
  },
  {
    key: "certifications",
    title: "Certifications",
    description: "Credentials you have earned",
    help: "Include the certification name, issuer and date. List only credentials you actually hold.",
    placeholder: "Certification · Issuer · Date",
  },
  {
    key: "languages",
    title: "Languages",
    description: "The languages you work in",
    help: "List each language and your actual proficiency. Include a certification level only if you have one.",
    placeholder: "Spanish — native\nEnglish — intermediate",
  },
] as const;
export type SectionKey = (typeof sections)[number]["key"];
export type EditorSection = SectionKey | "contact" | "setup";
export const contactFields = [
  ["fullName", "Full name"],
  ["headline", "Professional headline"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["location", "Location"],
  ["links", "Portfolio / LinkedIn"],
] as const;
