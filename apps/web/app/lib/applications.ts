export const categories = [
  ["IT", "IT"],
  ["NON_IT", "Non-IT"],
  ["UNCATEGORIZED", "Uncategorized"],
] as const;
export type Category = (typeof categories)[number][0];
export const stages = [
  ["WISHLIST", "Wishlist"],
  ["APPLIED", "Applied"],
  ["SCREENING", "Screening"],
  ["TECHNICAL_INTERVIEW", "Technical interview"],
  ["FINAL_INTERVIEW", "Final interview"],
  ["OFFER", "Offer"],
  ["REJECTED", "Rejected"],
  ["WITHDRAWN", "Withdrawn"],
] as const;
export type Status = (typeof stages)[number][0];
export type Application = {
  id: string;
  position: string;
  company: { name: string };
  location: string | null;
  jobUrl: string | null;
  status: Status;
  category: Category;
  jobDescription: string | null;
  createdAt: string;
  resumes?: { id: string; reviewedAt: string | null }[];
};
