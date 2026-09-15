import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Profile } from './contracts';
import { DEMO_EMAIL } from '../local-user';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}
  async get() {
    return this.prisma.professionalProfile.findFirst({
      where: { user: { email: DEMO_EMAIL } },
    });
  }
  async save(content: Profile) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: DEMO_EMAIL },
        update: {},
        create: { email: DEMO_EMAIL, name: 'Local workspace' },
      });
      return tx.professionalProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, content },
        update: { content },
      });
    });
  }
}
