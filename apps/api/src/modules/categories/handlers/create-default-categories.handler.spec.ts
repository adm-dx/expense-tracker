import { CreateDefaultCategoriesHandler } from './create-default-categories.handler';
import { CreateDefaultCategoriesCommand } from '../contracts';
import { CategoriesService } from '../categories.service';

describe('CreateDefaultCategoriesHandler', () => {
  it('delegates to CategoriesService.createDefaults', async () => {
    const categoriesService = {
      createDefaults: jest.fn().mockResolvedValue(undefined),
    } as unknown as CategoriesService;
    const handler = new CreateDefaultCategoriesHandler(categoriesService);

    await handler.execute(new CreateDefaultCategoriesCommand('user-1'));

    expect(categoriesService.createDefaults).toHaveBeenCalledWith('user-1');
  });
});
