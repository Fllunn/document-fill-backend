import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';

import { TemplatesService } from './templates.service';
import { ITemplateToEdit } from './interfaces/ITemplatesToEdit';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // POST /templates - Create a new template
  @Post()
  @UseGuards(AuthGuard) // только авторизованные
  create(@Body() template: ITemplate, @Req() request: any) {
    // request.user содержит информацию о текущем пользователе из JWT
    return this.templatesService.create(template, request.user);
  }
  
  // GET /templates - Get all templates
  @Get()
  @UseGuards(AuthGuard) // только авторизованные
  findAll(@Req() request: any) {
    return this.templatesService.findAll(request.user);
  }

  // GET /templates/:id - Get a specific template
  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.findOne(id, request.user);
  }

  // DELETE /templates/:id - Delete a template
  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  delete(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.delete(id, request.user);
  }

  // PATCH /templates/:id - Update a template
  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  update(@Param('id') id: string, @Body() templateToEdit: ITemplateToEdit, @Req() request: any) {
    return this.templatesService.update(id, request.user, templateToEdit);
  }

  // GET /templates/:id/variables - Get variables of a template
  @Get(':id/variables')
  @UseGuards(AuthGuard) // только авторизованные
  getTemplateVariables(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.getTemplateVariables(id, request.user);
  }
}
