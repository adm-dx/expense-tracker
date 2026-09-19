import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateDefaultCategoriesCommand } from '../contracts';
import { CategoriesService } from '../categories.service';

@CommandHandler(CreateDefaultCategoriesCommand)
export class CreateDefaultCategoriesHandler
  implements ICommandHandler<CreateDefaultCategoriesCommand, void>
{
  constructor(private readonly categoriesService: CategoriesService) {}

  execute(command: CreateDefaultCategoriesCommand): Promise<void> {
    return this.categoriesService.createDefaults(command.userId);
  }
}
