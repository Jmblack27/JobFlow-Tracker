import {
  Body,
  Controller,
  Injectable,
  ConflictException,
  BadRequestException,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { ApplicationStatus, JobCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from './profile.service';
import {
  descriptionSchema,
  parseInput,
  profileSchema,
  verifyEvidence,
} from './contracts';
import {
  manualResponseSchema,
  parseResponseJson,
  preparePrompt,
  sourceIdFor,
  PROMPT_VERSION,
} from './manual-prompt';
import { parseApplicationInput } from '../applications/application-input';
import { DEMO_EMAIL } from '../local-user';

const detailsSchema = z
  .object({
    category: z.enum(JobCategory).default('UNCATEGORIZED'),
    companyName: z.string().trim().max(200),
    position: z.string().trim().max(200),
    location: z.string().trim().max(200),
    jobUrl: z.string().trim().max(2048),
  })
  .strict();
export const draftResponseSchema = manualResponseSchema.extend({
  application: detailsSchema,
});
const previewSchema = descriptionSchema.extend({
  response: z.string().trim().min(1).max(80000),
});
const saveSchema = previewSchema.extend({
  application: detailsSchema.extend({
    status: z.enum(ApplicationStatus),
    platform: z.string().trim().max(200).nullable().optional(),
  }),
});
const draftSource = 'new-application-v1';

@Injectable()
export class ApplicationDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
  ) {}
  private async profile() {
    const saved = await this.profiles.get();
    if (!saved)
      throw new BadRequestException(
        'Save My Profile before preparing a prompt. You can also save the application manually.',
      );
    return profileSchema.parse(saved.content);
  }
  async prompt(jobDescription: string) {
    const profile = await this.profile();
    const prepared = preparePrompt(
      draftSource,
      profile,
      jobDescription,
      draftResponseSchema,
    );
    return {
      ...prepared,
      prompt:
        prepared.prompt +
        '\nADDITIONAL TASK\nExtract application.companyName, position, location and jobUrl ONLY from the job offer. Use an empty string for any missing field. Never guess company names or links. Set application.category to IT for computing and information technology duties, NON_IT for other work (such as retail, hospitality, logistics, administration or customer service), or UNCATEGORIZED if unclear. Classify the duties, not the employer industry. The user will review these details before saving.',
    };
  }
  async preview(jobDescription: string, response: string) {
    const profile = await this.profile();
    const result = parseInput(draftResponseSchema, parseResponseJson(response));
    if (result.sourceId !== sourceIdFor(draftSource, profile, jobDescription))
      throw new ConflictException(
        'Your profile or offer changed. Prepare a new prompt and import its response.',
      );
    try {
      verifyEvidence(
        [
          ...result.analysis.matchingSkills,
          result.resume.summary,
          ...result.resume.sections.flatMap((s) => s.items),
        ],
        profile,
      );
    } catch {
      throw new BadRequestException(
        'Some evidence does not match your profile. Use exact quotes from the prompt.',
      );
    }
    return { result, profile };
  }
  async save(input: z.infer<typeof saveSchema>) {
    const { result, profile } = await this.preview(
      input.jobDescription,
      input.response,
    );
    const details = parseApplicationInput(input.application);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: DEMO_EMAIL },
        update: {},
        create: { email: DEMO_EMAIL, name: 'Local workspace' },
      });
      const application = await tx.jobApplication.create({
        data: {
          position: details.position!,
          location: details.location,
          jobUrl: details.jobUrl,
          status: details.status,
          category: details.category,
          platform: details.platform,
          jobDescription: input.jobDescription,
          user: { connect: { id: user.id } },
          company: { create: { name: details.companyName! } },
        },
        include: { company: true },
      });
      const metadata = {
        applicationId: application.id,
        profileSnapshot: profile,
        jobDescription: input.jobDescription,
        model: 'manual-chatgpt',
        promptVersion: PROMPT_VERSION,
      };
      const analysis = await tx.applicationAnalysis.create({
        data: { ...metadata, content: result.analysis },
      });
      const resume = await tx.resumeVersion.create({
        data: { ...metadata, analysisId: analysis.id, content: result.resume },
      });
      return {
        ...application,
        resumes: [{ id: resume.id, reviewedAt: resume.reviewedAt }],
      };
    });
  }
}
@Controller('application-drafts')
export class ApplicationDraftsController {
  constructor(private readonly drafts: ApplicationDraftsService) {}
  @Post('prompt')
  prompt(@Body() body: unknown) {
    return this.drafts.prompt(
      parseInput(descriptionSchema, body).jobDescription,
    );
  }
  @Post('preview')
  async preview(@Body() body: unknown) {
    const input = parseInput(previewSchema, body);
    return (await this.drafts.preview(input.jobDescription, input.response))
      .result;
  }
  @Post()
  save(@Body() body: unknown) {
    return this.drafts.save(parseInput(saveSchema, body));
  }
}
