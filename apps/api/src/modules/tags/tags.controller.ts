import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.tagsService.list(user.sub);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.tagsService.get(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTagDto) {
    return this.tagsService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto
  ) {
    return this.tagsService.update(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.tagsService.remove(user.sub, id);
  }
}
