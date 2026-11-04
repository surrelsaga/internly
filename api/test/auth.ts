import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { COOKIE, signToken } from '../src/auth/current-user.js';
import { User } from '../src/users/user.entity.js';

// A valid login cookie for a user, as the browser would send it.
export const cookieFor = (userId: string) => `${COOKIE}=${signToken(userId)}`;

// A supertest agent signed in as the seeded owner.
export async function ownerAgent(app: INestApplication) {
  const email = process.env.ALLOWED_EMAILS!.split(',')[0].trim().toLowerCase();
  const owner = await app.get(DataSource).getRepository(User).findOneByOrFail({ email });
  return request.agent(app.getHttpServer()).set('Cookie', cookieFor(owner.id));
}
