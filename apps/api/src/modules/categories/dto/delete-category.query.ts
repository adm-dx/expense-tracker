import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeleteCategoryQuery {
  /** Move the category's transactions to this category before deleting it. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reassignTo?: string;
}
