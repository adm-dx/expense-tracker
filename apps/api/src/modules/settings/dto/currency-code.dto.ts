import { CURRENCIES, type Currency } from '@expense-tracker/types';
import { IsIn } from 'class-validator';

// `POST /settings/currencies` body and `DELETE /settings/currencies/:code` params.
export class CurrencyCodeDto {
  @IsIn(CURRENCIES)
  code!: Currency;
}
