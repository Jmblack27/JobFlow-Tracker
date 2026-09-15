import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  ConflictException,
} from '@nestjs/common';
import { importResponseSchema } from './manual-prompt';
import { ProfileService } from './profile.service';
import { CareerService } from './career.service';
import { ResumePdfService } from './resume-pdf.service';
import {
  descriptionSchema,
  editResumeSchema,
  parseInput,
  profileSchema,
  resumeSchema,
} from './contracts';

@Controller()
export class CareerController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly career: CareerService,
    private readonly pdf: ResumePdfService,
  ) {}
  @Get('profile')
  async profile() {
    return (await this.profiles.get()) ?? { content: null };
  }
  @Put('profile')
  saveProfile(@Body() body: unknown) {
    return this.profiles.save(parseInput(profileSchema, body));
  }
  @Get('applications/:id/resume-workspace')
  workspace(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.career.workspace(id);
  }
  @Put('applications/:id/description')
  description(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.career.description(
      id,
      parseInput(descriptionSchema, body).jobDescription,
    );
  }
  @Get('applications/:id/resume-prompt')
  prompt(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.career.prompt(id);
  }
  @Post('applications/:id/resumes/import')
  importResponse(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.career.importResponse(
      id,
      parseInput(importResponseSchema, body).response,
    );
  }
  @Patch('applications/:id/resumes/:resumeId')
  edit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('resumeId', new ParseUUIDPipe()) resumeId: string,
    @Body() body: unknown,
  ) {
    const input = parseInput(editResumeSchema, body);
    return this.career.edit(
      id,
      resumeId,
      input.content,
      input.reviewed,
      input.updatedAt,
    );
  }
  @Get('applications/:id/resumes/:resumeId/pdf')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('resumeId', new ParseUUIDPipe()) resumeId: string,
  ) {
    const resume = await this.career.getResume(id, resumeId);
    if (!resume.reviewedAt)
      throw new ConflictException(
        'Review and save this resume before downloading.',
      );
    const buffer = await this.pdf.render(
      profileSchema.parse(resume.profileSnapshot),
      resumeSchema.parse(resume.content),
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="resume-' + resumeId + '.pdf"',
    });
  }
}
