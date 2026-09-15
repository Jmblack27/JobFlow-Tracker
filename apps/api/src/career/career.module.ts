import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { CareerController } from './career.controller';
import { CareerService } from './career.service';
import { ProfileService } from './profile.service';
import { ResumePdfService } from './resume-pdf.service';

@Module({
  imports: [ApplicationsModule],
  controllers: [CareerController],
  providers: [CareerService, ProfileService, ResumePdfService],
})
export class CareerModule {}
