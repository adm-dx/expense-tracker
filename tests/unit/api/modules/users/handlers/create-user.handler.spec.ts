import { CreateUserHandler } from '@api/modules/users/handlers/create-user.handler';
import { CreateUserCommand } from '@api/modules/users/contracts';
import { UsersService } from '@api/modules/users/users.service';

describe('CreateUserHandler', () => {
  it('delegates to UsersService.create', async () => {
    const usersService = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as UsersService;
    const handler = new CreateUserHandler(usersService);

    const result = await handler.execute(
      new CreateUserCommand('Jane', 'jane@example.com', 'hashed')
    );

    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      passwordHash: 'hashed',
    });
    expect(result).toEqual({ id: 'user-1' });
  });
});
