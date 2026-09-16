import { UserLoggedInHandler } from './user-logged-in.handler';
import { UserLoggedInEvent } from '../../auth/contracts';
import { UsersService } from '../users.service';

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
