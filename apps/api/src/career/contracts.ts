import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const short = z.string().trim().max(200);
const section = z.string().trim().max(8000);
export const profileSchema = z
  .object({
    fullName: short.min(1),
    headline: short,
    email: z.union([z.literal(''), z.email()]),
    phone: short,
    location: short,
    links: z.string().trim().max(1000),
    skills: section.min(1),
    experience: section,
    projects: section,
    education: section,
    certifications: section,
    languages: section,
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export const evidenceSections = [
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'languages',
] as const;
const evidence = z
  .object({
    section: z.enum(evidenceSections),
    quote: z.string().min(1).max(1500),
  })
  .strict();
export const claimSchema = z
  .object({
    text: z.string().min(1).max(2000),
    evidence: z.array(evidence).min(1).max(8),
  })
  .strict();
export const analysisSchema = z
  .object({
    roleSummary: z.string().min(1).max(1500),
    matchingSkills: z
      .array(
        z
          .object({
            requirement: z.string().min(1).max(500),
            evidence: z.array(evidence).min(1).max(8),
          })
          .strict(),
      )
      .max(30),
    missingRequirements: z.array(z.string().min(1).max(500)).max(30),
    questions: z.array(z.string().min(1).max(500)).max(15),
  })
  .strict();
export const resumeSchema = z
  .object({
    summary: claimSchema,
    sections: z
      .array(
        z
          .object({
            title: z.enum([
              'Skills',
              'Experience',
              'Projects',
              'Education',
              'Certifications',
              'Languages',
            ]),
            items: z.array(claimSchema).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(6),
  })
  .strict();
export type Analysis = z.infer<typeof analysisSchema>;
export type ResumeContent = z.infer<typeof resumeSchema>;
export const descriptionSchema = z
  .object({
    jobDescription: z.string().trim().min(50).max(20000),
  })
  .strict();
export const editResumeSchema = z
  .object({
    content: resumeSchema,
    reviewed: z.boolean(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export function parseInput<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException(
      result.error.issues
        .map((issue) => issue.path.join('.') + ': ' + issue.message)
        .join('; '),
    );
  }
  return result.data;
}

// Checks that cited evidence exists; semantic accuracy still requires human review.
export function verifyEvidence(
  groups: {
    evidence: { section: (typeof evidenceSections)[number]; quote: string }[];
  }[],
  profile: Profile,
) {
  for (const group of groups) {
    for (const item of group.evidence) {
      if (!item.quote.trim() || !profile[item.section].includes(item.quote)) {
        throw new Error(
          'Generated evidence does not exist in the source profile',
        );
      }
    }
  }
}
