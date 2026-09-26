import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import {
  ChangeUserPasswordCommand,
  CreateUserCommand,
  GetUserByIdQuery,
  GetUserCredentialsByIdQuery,
  GetUserCredentialsQuery,
  PublicUser,
  UserCredentials,
} from '../users/contracts';
import { CreateDefaultCategoriesCommand } from '../categories/contracts';
import { UserLoggedInEvent } from './contracts';
import { TokenService, AuthTokens } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly eventBus: EventBus,
    private readonly tokenService: TokenService,
  ) {}

  async register(
    dto: RegisterDto,
  ): Promise<AuthTokens & { user: PublicUser }> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.commandBus.execute<CreateUserCommand, PublicUser>(
      new CreateUserCommand(dto.name, dto.email, passwordHash),
    );
    // Awaited so the client sees the categories right after registration, but
    // never fatal: the account exists at this point and its email is taken, so
    // failing the request would leave the user unable to register again.
    try {
      await this.commandBus.execute<CreateDefaultCategoriesCommand, void>(
        new CreateDefaultCategoriesCommand(user.id),
      );
    } catch (error) {
      this.logger.error(
        `Failed to create default categories for user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    const tokens = await this.tokenService.issueTokens(user);
    return { ...tokens, user };
  }

  async login(dto: LoginDto): Promise<AuthTokens & { user: PublicUser }> {
    const credentials = await this.queryBus.execute<
      GetUserCredentialsQuery,
      UserCredentials | null
    >(new GetUserCredentialsQuery(dto.email));

    const passwordMatches = credentials
      ? await bcrypt.compare(dto.password, credentials.passwordHash)
      : false;

    if (!credentials || !credentials.isActive || !passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.eventBus.publish(new UserLoggedInEvent(credentials.id, new Date()));

    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      PublicUser | null
    >(new GetUserByIdQuery(credentials.id));
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.issueTokens(user);
    return { ...tokens, user };
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokenService.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revoke(refreshToken);
  }

  /**
   * Checks the current password, stores the new one and signs the user out
   * of every session. The caller's session continues with the returned
   * tokens; other devices keep only their access token, until it expires.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<AuthTokens> {
    const credentials = await this.queryBus.execute<
      GetUserCredentialsByIdQuery,
      UserCredentials | null
    >(new GetUserCredentialsByIdQuery(userId));
    if (!credentials || !credentials.isActive) {
      throw new UnauthorizedException();
    }

    // 400, not 401: the client treats a 401 as an expired session.
    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      credentials.passwordHash,
    );
    if (!currentMatches) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password must differ from the current one',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
    await this.commandBus.execute<ChangeUserPasswordCommand, void>(
      new ChangeUserPasswordCommand(userId, passwordHash),
    );
    await this.tokenService.revokeAll(userId);

    const user = await this.queryBus.execute<
      GetUserByIdQuery,
      PublicUser | null
    >(new GetUserByIdQuery(userId));
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.tokenService.issueTokens(user);
  }

  me(userId: string): Promise<PublicUser | null> {
    return this.queryBus.execute<GetUserByIdQuery, PublicUser | null>(
      new GetUserByIdQuery(userId),
    );
  }
}
