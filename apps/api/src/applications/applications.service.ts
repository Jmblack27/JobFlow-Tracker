import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ApplicationInput } from './application-input';

// The first slice is a single-user local workspace, pending authentication.
import { DEMO_EMAIL as demoEmail } from '../local-user';
const include = {
  company: true,
  resumes: {
    select: { id: true, reviewedAt: true },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
    take: 1,
  },
} satisfies Prisma.JobApplicationInclude;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.jobApplication.findMany({
      where: { user: { email: demoEmail } },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  async get(id: string) {
    const application = await this.prisma.jobApplication.findFirst({
      where: { id, user: { email: demoEmail } },
      include,
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }
  async create(input: ApplicationInput) {
    const { companyName, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: demoEmail },
        update: {},
        create: { email: demoEmail, name: 'Local workspace' },
      });
      return tx.jobApplication.create({
        data: {
          ...data,
          position: input.position!,
          user: { connect: { id: user.id } },
          company: { create: { name: companyName! } },
        },
        include,
      });
    });
  }
  async update(id: string, input: ApplicationInput) {
    const { companyName, ...data } = input;
    try {
      return await this.prisma.jobApplication.update({
        where: { id, user: { email: demoEmail } },
        data: {
          ...data,
          ...(companyName
            ? { company: { create: { name: companyName } } }
            : {}),
        },
        include,
      });
    } catch (error) {
      this.rethrow(error);
    }
  }
  async remove(id: string) {
    try {
      await this.prisma.jobApplication.delete({
        where: { id, user: { email: demoEmail } },
      });
    } catch (error) {
      this.rethrow(error);
    }
  }
  private rethrow(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Application not found');
    }
    throw error;
  }
}
