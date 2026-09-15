import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsService } from '../applications/applications.service';
import { ProfileService } from './profile.service';
import { profileSchema, verifyEvidence } from './contracts';
import type { ResumeContent } from './contracts';
import { DEMO_EMAIL } from '../local-user';
import {
  parseManualResponse,
  preparePrompt,
  PROMPT_VERSION,
  sourceIdFor,
} from './manual-prompt';

@Injectable()
export class CareerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly profiles: ProfileService,
  ) {}
  private async source(id: string) {
    const application = await this.applications.get(id);
    const saved = await this.profiles.get();
    if (!saved)
      throw new BadRequestException(
        'Save My Profile before preparing a prompt.',
      );
    if (!application.jobDescription)
      throw new BadRequestException('Save a job description first.');
    return {
      profile: profileSchema.parse(saved.content),
      jobDescription: application.jobDescription,
    };
  }
  async workspace(id: string) {
    const application = await this.applications.get(id);
    const [profile, analysis, resumes] = await Promise.all([
      this.profiles.get(),
      this.prisma.applicationAnalysis.findFirst({
        where: { applicationId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.resumeVersion.findMany({
        where: { applicationId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    ]);
    const analysisCurrent =
      !!analysis &&
      !!profile &&
      analysis.jobDescription === application.jobDescription &&
      JSON.stringify(profileSchema.parse(analysis.profileSnapshot)) ===
        JSON.stringify(profileSchema.parse(profile.content));
    return {
      application,
      analysis,
      resumes,
      analysisCurrent,
      hasProfile: !!profile,
    };
  }
  async description(id: string, jobDescription: string) {
    await this.applications.get(id);
    return this.prisma.jobApplication.update({
      where: { id, user: { email: DEMO_EMAIL } },
      data: { jobDescription },
    });
  }
  async prompt(id: string) {
    const source = await this.source(id);
    return preparePrompt(id, source.profile, source.jobDescription);
  }
  async importResponse(id: string, response: string) {
    const source = await this.source(id);
    const result = parseManualResponse(response);
    if (
      result.sourceId !== sourceIdFor(id, source.profile, source.jobDescription)
    ) {
      throw new ConflictException(
        'This response belongs to a different application or an older profile or offer. Prepare a new prompt and use its response.',
      );
    }
    try {
      verifyEvidence(
        [
          ...result.analysis.matchingSkills,
          result.resume.summary,
          ...result.resume.sections.flatMap((section) => section.items),
        ],
        source.profile,
      );
    } catch {
      throw new BadRequestException(
        'Some source evidence does not match your saved profile. Ask ChatGPT to use exact quotes from the prompt and paste the corrected response.',
      );
    }
    // Analysis and resume are saved together, or neither is saved.
    return this.prisma.$transaction(async (tx) => {
      const metadata = {
        applicationId: id,
        profileSnapshot: source.profile,
        jobDescription: source.jobDescription,
        model: 'manual-chatgpt',
        promptVersion: PROMPT_VERSION,
      };
      const analysis = await tx.applicationAnalysis.create({
        data: { ...metadata, content: result.analysis },
      });
      return tx.resumeVersion.create({
        data: { ...metadata, analysisId: analysis.id, content: result.resume },
      });
    });
  }
  async getResume(id: string, resumeId: string) {
    const resume = await this.prisma.resumeVersion.findFirst({
      where: {
        id: resumeId,
        applicationId: id,
        application: { user: { email: DEMO_EMAIL } },
      },
    });
    if (!resume) throw new NotFoundException('Resume not found');
    return resume;
  }
  async edit(
    id: string,
    resumeId: string,
    content: ResumeContent,
    reviewed: boolean,
    updatedAt: string,
  ) {
    await this.getResume(id, resumeId);
    const result = await this.prisma.resumeVersion.updateMany({
      where: {
        id: resumeId,
        applicationId: id,
        updatedAt: new Date(updatedAt),
        application: { user: { email: DEMO_EMAIL } },
      },
      data: { content, reviewedAt: reviewed ? new Date() : null },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'This resume changed in another tab. Reload before saving.',
      );
    return this.getResume(id, resumeId);
  }
}
