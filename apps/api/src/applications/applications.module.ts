import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  exports: [PrismaService, ApplicationsService],
  controllers: [ApplicationsController],
  providers: [PrismaService, ApplicationsService],
})
export class ApplicationsModule {}
