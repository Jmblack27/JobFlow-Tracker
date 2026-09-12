import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { parseApplicationInput } from './application-input';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}
  @Get()
  list() {
    return this.applications.list();
  }
  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.applications.get(id);
  }
  @Post()
  create(@Body() body: unknown) {
    return this.applications.create(parseApplicationInput(body));
  }
  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown) {
    return this.applications.update(id, parseApplicationInput(body, true));
  }
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.applications.remove(id);
  }
}
