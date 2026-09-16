import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus, JobCategory } from '@prisma/client';

export interface ApplicationInput {
  companyName?: string;
  position?: string;
  location?: string | null;
  jobUrl?: string | null;
  platform?: string | null;
  status?: ApplicationStatus;
  category?: JobCategory;
  jobDescription?: string | null;
}

export function parseApplicationInput(
  body: unknown,
  partial = false,
): ApplicationInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Expected an application object');
  }
  const input = body as Record<string, unknown>;
  const allowed = [
    'companyName',
    'position',
    'location',
    'jobUrl',
    'platform',
    'status',
    'jobDescription',
    'category',
  ];
  if (
    !Object.keys(input).length ||
    Object.keys(input).some((key) => !allowed.includes(key))
  ) {
    throw new BadRequestException('Provide only supported application fields');
  }
  const result: ApplicationInput = {};
  for (const key of [
    'companyName',
    'position',
    'location',
    'jobUrl',
    'platform',
  ] as const) {
    const value = input[key];
    const required = key === 'companyName' || key === 'position';
    if (value === undefined) {
      if (required && !partial)
        throw new BadRequestException(key + ' is required');
      continue;
    }
    if (value === null && !required) {
      result[key] = null;
      continue;
    }
    if (
      typeof value !== 'string' ||
      value.trim().length > (key === 'jobUrl' ? 2048 : 200) ||
      (required && !value.trim())
    ) {
      throw new BadRequestException(
        key + ' must be a non-empty string of valid length',
      );
    }
    if (key === 'platform') {
      result.platform = value.trim().replace(/\s+/g, ' ') || null;
    } else {
      result[key] = value.trim();
    }
  }
  if (input.jobDescription !== undefined) {
    if (input.jobDescription === null) result.jobDescription = null;
    else if (
      typeof input.jobDescription !== 'string' ||
      input.jobDescription.trim().length > 20000
    )
      throw new BadRequestException(
        'Job description must be at most 20,000 characters',
      );
    else result.jobDescription = input.jobDescription.trim() || null;
  }
  if (result.jobUrl) {
    try {
      const url = new URL(result.jobUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new BadRequestException('jobUrl must be an HTTP or HTTPS URL');
    }
  }
  if (input.status !== undefined) {
    if (
      !Object.values(ApplicationStatus).includes(
        input.status as ApplicationStatus,
      )
    ) {
      throw new BadRequestException('Invalid application status');
    }
    result.status = input.status as ApplicationStatus;
  }
  if (input.category !== undefined) {
    if (!Object.values(JobCategory).includes(input.category as JobCategory))
      throw new BadRequestException('Invalid job category');
    result.category = input.category as JobCategory;
  }
  return result;
}
