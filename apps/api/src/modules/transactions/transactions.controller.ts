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
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ListTransactionsQuery } from './dto/list-transactions.query';
import { SummaryQuery } from './dto/summary.query';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListTransactionsQuery
  ) {
    return this.transactionsService.list(user.sub, query);
  }

  // Declared before ':id' so "summary" is not captured as an id.
  @Get('summary')
  summary(@CurrentUser() user: RequestUser, @Query() query: SummaryQuery) {
    return this.transactionsService.summary(user.sub, query);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.transactionsService.get(user.sub, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto
  ) {
    return this.transactionsService.update(user.sub, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.transactionsService.remove(user.sub, id);
  }
}
