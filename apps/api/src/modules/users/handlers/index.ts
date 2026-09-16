import { CreateUserHandler } from './create-user.handler';
import { GetUserByIdHandler } from './get-user-by-id.handler';
import { GetUserCredentialsHandler } from './get-user-credentials.handler';
import { UserLoggedInHandler } from './user-logged-in.handler';

export const UsersHandlers = [
  CreateUserHandler,
  GetUserByIdHandler,
  GetUserCredentialsHandler,
  UserLoggedInHandler,
];
