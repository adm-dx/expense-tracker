import { GetUserCredentialsHandler } from '@api/modules/users/handlers/get-user-credentials.handler';
import { GetUserCredentialsQuery } from '@api/modules/users/contracts';
import { UsersService } from '@api/modules/users/users.service';

describe('GetUserCredentialsHandler', () => {
  it('delegates to UsersService.getCredentials', async () => {
    const credentials = {
      id: 'user-1',
      email: 'jane@example.com',
      passwordHash: 'hashed',
      isActive: true,
    };
    const usersService = {
      getCredentials: jest.fn().mockResolvedValue(credentials),
    } as unknown as UsersService;
    const handler = new GetUserCredentialsHandler(usersService);

    const result = await handler.execute(
      new GetUserCredentialsQuery('jane@example.com')
    );

    expect(usersService.getCredentials).toHaveBeenCalledWith(
      'jane@example.com'
    );
    expect(result).toEqual(credentials);
  });
});
