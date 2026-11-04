import { Controller, Get, Injectable, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Strategy } from 'passport-google-oauth20';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity.js';
import { COOKIE, CurrentUser, Public, signToken, THIRTY_DAYS_MS } from './current-user.js';

type Users = Pick<Repository<User>, 'findOneBy' | 'save' | 'create'>;
export type GoogleLogin = { googleId: string; email: string; emailVerified: boolean; name: string };

// The login rule. Returns the user to sign in, or null if the login is rejected.
export async function validateLogin(login: GoogleLogin, allowedEmails: string | undefined, users: Users) {
  const email = login.email.trim().toLowerCase();
  const allowed = (allowedEmails ?? '').split(',').map((e) => e.trim().toLowerCase());
  if (!login.emailVerified || !allowed.includes(email)) return null;
  const byGoogleId = await users.findOneBy({ googleId: login.googleId });
  if (byGoogleId) return byGoogleId;
  // First sign-in: the seeded owner (found by email) gets their googleId attached.
  const user = (await users.findOneBy({ email })) ?? users.create({ email, name: login.name });
  user.googleId = login.googleId;
  return users.save(user);
}

type GoogleProfile = { id: string; displayName: string; emails?: { value: string }[]; _json: { email_verified?: boolean | string } };

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@InjectRepository(User) private users: Repository<User>) {
    super({
      // ponytail: placeholders keep the app booting without Google env (tests); login just won't work.
      clientID: process.env.GOOGLE_CLIENT_ID || 'unset',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'unset',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/api/auth/google/callback',
      scope: ['openid', 'email', 'profile'],
    });
  }

  async validate(_access: string, _refresh: string, profile: GoogleProfile) {
    const email = profile.emails?.[0]?.value;
    if (!email) return null;
    const verified = profile._json.email_verified;
    return validateLogin(
      { googleId: profile.id, email, emailVerified: verified === true || verified === 'true', name: profile.displayName || email.split('@')[0] },
      process.env.ALLOWED_EMAILS,
      this.users,
    );
  }
}

// A rejected login (or a denied consent screen) arrives as no user, not as a 401.
class GoogleGuard extends AuthGuard('google') {
  handleRequest<T>(_err: unknown, user: T): T {
    return user || (null as T);
  }
}

const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.APP_ENV === 'production', path: '/' });

@Controller('auth')
export class AuthController {
  @Public()
  @UseGuards(GoogleGuard)
  @Get('google')
  start() {}

  @Public()
  @UseGuards(GoogleGuard)
  @Get('google/callback')
  callback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User | null;
    if (!user) return res.redirect('/login?error=not-allowed');
    res.cookie(COOKIE, signToken(user.id), { ...cookieOptions(), maxAge: THIRTY_DAYS_MS });
    res.redirect('/');
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return { id: user.id, email: user.email, name: user.name };
  }

  @Public()
  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie(COOKIE, cookieOptions());
    res.status(204).end();
  }
}
