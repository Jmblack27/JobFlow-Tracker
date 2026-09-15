import type { Analysis, Profile, ResumeContent } from '../src/career/contracts';

export const profileFixture: Profile = {
  fullName: 'Alex Morgan',
  headline: 'Software engineer',
  email: 'alex@example.com',
  phone: '',
  location: 'Bogota',
  links: '',
  skills: 'TypeScript, NestJS and PostgreSQL',
  experience: 'Acme | Engineer | 2022–2024. Built an internal API with NestJS.',
  projects: 'Personal project: JobFlow, a job application tracker.',
  education: 'BSc Computer Science, Example University, 2022.',
  certifications: '',
  languages: 'English B2',
};
export const evidenceFixture = {
  section: 'skills' as const,
  quote: 'TypeScript, NestJS and PostgreSQL',
};
export const analysisFixture: Analysis = {
  roleSummary: 'Backend role requiring NestJS and AWS.',
  matchingSkills: [{ requirement: 'NestJS', evidence: [evidenceFixture] }],
  missingRequirements: ['AWS'],
  questions: ['Have you used AWS in a project?'],
};
export const resumeFixture: ResumeContent = {
  summary: {
    text: 'Engineer with NestJS and PostgreSQL skills.',
    evidence: [evidenceFixture],
  },
  sections: [
    {
      title: 'Skills',
      items: [
        {
          text: 'TypeScript, NestJS and PostgreSQL',
          evidence: [evidenceFixture],
        },
      ],
    },
  ],
};
export const descriptionFixture =
  'Backend engineer using NestJS and PostgreSQL. AWS experience is required.';
