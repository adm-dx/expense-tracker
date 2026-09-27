import { ChangeUserPasswordHandler } from '@api/modules/users/handlers/change-user-password.handler';
import { ChangeUserPasswordCommand } from '@api/modules/users/contracts';
import { UsersService } from '@api/modules/users/users.service';

describe('ChangeUserPasswordHandler', () => {
  it('delegates to UsersService.changePassword', async () => {
    const usersService = {
      changePassword: jest.fn().mockResolvedValue(undefined),
    } as unknown as UsersService;
    const handler = new ChangeUserPasswordHandler(usersService);

    await handler.execute(new ChangeUserPasswordCommand('user-1', 'hashed'));

    expect(usersService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'hashed'
    );
  });
});
