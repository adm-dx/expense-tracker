import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type {
  RemoveCurrencyResult,
  UserSettings,
} from '@expense-tracker/types';
import { SettingsService } from './settings.service';
import { CurrencyCodeDto } from './dto/currency-code.dto';
import { ReplaceSettingsDto } from './dto/replace-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: RequestUser): Promise<UserSettings> {
    return this.settingsService.get(user.sub);
  }

  @Put()
  replace(
    @CurrentUser() user: RequestUser,
    @Body() dto: ReplaceSettingsDto
  ): Promise<UserSettings> {
    return this.settingsService.replace(user.sub, dto);
  }

  @Patch()
  update(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateSettingsDto
  ): Promise<UserSettings> {
    return this.settingsService.update(user.sub, dto);
  }

  /**
   * Resets every setting but the enabled currencies to its default and
   * answers with the result.
   */
  @Delete()
  reset(@CurrentUser() user: RequestUser): Promise<UserSettings> {
    return this.settingsService.reset(user.sub);
  }

  /** Enables a currency; enabling one twice changes nothing. */
  @Post('currencies')
  @HttpCode(200)
  addCurrency(
    @CurrentUser() user: RequestUser,
    @Body() dto: CurrencyCodeDto
  ): Promise<UserSettings> {
    return this.settingsService.addCurrency(user.sub, dto.code);
  }

  /** Disables a currency and converts its transactions to RSD. */
  @Delete('currencies/:code')
  removeCurrency(
    @CurrentUser() user: RequestUser,
    @Param() params: CurrencyCodeDto
  ): Promise<RemoveCurrencyResult> {
    return this.settingsService.removeCurrency(user.sub, params.code);
  }
}
