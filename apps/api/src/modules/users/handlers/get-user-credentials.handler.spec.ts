import { GetUserCredentialsHandler } from './get-user-credentials.handler';
import { GetUserCredentialsQuery } from '../contracts';
import { UsersService } from '../users.service';

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
      new GetUserCredentialsQuery('jane@example.com'),
    );

    expect(usersService.getCredentials).toHaveBeenCalledWith(
      'jane@example.com',
    );
    expect(result).toEqual(credentials);
  });
});
