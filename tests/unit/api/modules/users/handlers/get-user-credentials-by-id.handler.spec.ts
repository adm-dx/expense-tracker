import { GetUserCredentialsByIdHandler } from '@api/modules/users/handlers/get-user-credentials-by-id.handler';
import { GetUserCredentialsByIdQuery } from '@api/modules/users/contracts';
import { UsersService } from '@api/modules/users/users.service';

describe('GetUserCredentialsByIdHandler', () => {
  it('delegates to UsersService.getCredentialsById', async () => {
    const credentials = {
      id: 'user-1',
      email: 'jane@example.com',
      passwordHash: 'hashed',
      isActive: true,
    };
    const usersService = {
      getCredentialsById: jest.fn().mockResolvedValue(credentials),
    } as unknown as UsersService;
    const handler = new GetUserCredentialsByIdHandler(usersService);

    const result = await handler.execute(
      new GetUserCredentialsByIdQuery('user-1')
    );

    expect(usersService.getCredentialsById).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(credentials);
  });
});
