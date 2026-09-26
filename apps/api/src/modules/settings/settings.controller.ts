import { Body, Controller, Delete, Get, Patch, Put } from '@nestjs/common';
import type { UserSettings } from '@expense-tracker/types';
import { SettingsService } from './settings.service';
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

  /** Resets every setting to its default and answers with the defaults. */
  @Delete()
  reset(@CurrentUser() user: RequestUser): Promise<UserSettings> {
    return this.settingsService.reset(user.sub);
  }
}
