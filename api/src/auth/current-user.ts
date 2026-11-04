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
import jwt from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';

export const Public = () => SetMetadata('isPublic', true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest().user,
);

export const COOKIE = 'token';
export const THIRTY_DAYS_MS = 30 * 24 * 3_600_000;

export const signToken = (userId: string) => jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '30d' });

// Global guard: the login cookie must hold a valid JWT for a user that still exists.
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride('isPublic', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    // ponytail: parse the one cookie by hand instead of adding cookie-parser.
    const token = req.headers.cookie?.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))?.[1];
    let id: unknown;
    try {
      id = token && jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }).sub;
    } catch {
      id = null;
    }
    const user = typeof id === 'string' ? await this.users.findOneBy({ id }) : null;
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}
