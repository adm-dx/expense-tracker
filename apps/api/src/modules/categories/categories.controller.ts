import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SearchCategoriesQuery } from './dto/search-categories.query';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: SearchCategoriesQuery
  ) {
    return this.categoriesService.list(user.sub, query.search);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.categoriesService.get(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto
  ) {
    return this.categoriesService.update(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.categoriesService.remove(user.sub, id);
  }
}
