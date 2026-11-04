import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';

export const Public = () => SetMetadata('isPublic', true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user,
);

// Stub until step 9 swaps in the real guard: everyone is the seeded owner.
@Injectable()
export class StubUserGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride('isPublic', [ctx.getHandler(), ctx.getClass()])) return true;
    const email = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim().toLowerCase();
    const user = email && (await this.users.findOneBy({ email }));
    if (!user) throw new UnauthorizedException('Run the seed first');
    ctx.switchToHttp().getRequest().user = user;
    return true;
  }
}
