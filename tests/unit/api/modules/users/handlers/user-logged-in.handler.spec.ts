import { UserLoggedInHandler } from '@api/modules/users/handlers/user-logged-in.handler';
import { UserLoggedInEvent } from '@api/modules/auth/contracts';
import { UsersService } from '@api/modules/users/users.service';

describe('UserLoggedInHandler', () => {
  it('delegates to UsersService.markLoggedIn', async () => {
    const usersService = {
      markLoggedIn: jest.fn().mockResolvedValue(undefined),
    } as unknown as UsersService;
    const handler = new UserLoggedInHandler(usersService);

    await handler.handle(new UserLoggedInEvent('user-1', new Date()));

    expect(usersService.markLoggedIn).toHaveBeenCalledWith('user-1');
  });
});
