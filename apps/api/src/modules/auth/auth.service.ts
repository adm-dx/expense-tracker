import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserCommand,
  GetUserByIdQuery,
  GetUserCredentialsQuery,
  PublicUser,
  UserCredentials,
} from '../users/contracts';
import { CreateDefaultCategoriesCommand } from '../categories/contracts';
import { UserLoggedInEvent } from './contracts';
import { TokenService, AuthTokens } from './token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
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
    // Awaited so the client sees the categories right after registration.
    await this.commandBus.execute<CreateDefaultCategoriesCommand, void>(
      new CreateDefaultCategoriesCommand(user.id),
    );
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

  me(userId: string): Promise<PublicUser | null> {
    return this.queryBus.execute<GetUserByIdQuery, PublicUser | null>(
      new GetUserByIdQuery(userId),
    );
  }
}
