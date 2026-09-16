import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchCategoriesQuery {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  search?: string;
}
