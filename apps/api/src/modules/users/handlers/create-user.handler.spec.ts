import { CreateUserHandler } from './create-user.handler';
import { CreateUserCommand } from '../contracts';
import { UsersService } from '../users.service';

describe('CreateUserHandler', () => {
  it('delegates to UsersService.create', async () => {
    const usersService = {
      create: jest.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as UsersService;
    const handler = new CreateUserHandler(usersService);

    const result = await handler.execute(
      new CreateUserCommand('Jane', 'jane@example.com', 'hashed'),
    );

    expect(usersService.create).toHaveBeenCalledWith({
      name: 'Jane',
      email: 'jane@example.com',
      passwordHash: 'hashed',
    });
    expect(result).toEqual({ id: 'user-1' });
  });
});
