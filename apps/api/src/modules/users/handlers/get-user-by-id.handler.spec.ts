import { GetUserByIdHandler } from './get-user-by-id.handler';
import { GetUserByIdQuery } from '../contracts';
import { UsersService } from '../users.service';

describe('GetUserByIdHandler', () => {
  it('delegates to UsersService.findById and never returns passwordHash', async () => {
    const publicUser = {
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue(publicUser),
    } as unknown as UsersService;
    const handler = new GetUserByIdHandler(usersService);

    const result = await handler.execute(new GetUserByIdQuery('user-1'));

    expect(usersService.findById).toHaveBeenCalledWith('user-1');
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toEqual(publicUser);
  });
});
