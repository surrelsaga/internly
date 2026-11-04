import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { COOKIE } from '../src/auth/current-user.js';
import { cookieFor, ownerAgent } from './auth.js';

describe('auth (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());

  it('a missing cookie returns 401', async () => {
    await http().get('/api/auth/me').expect(401);
    await http().get('/api/internship').expect(401);
  });

  it('an expired or tampered cookie returns 401', async () => {
    const { body } = await (await ownerAgent(app)).get('/api/auth/me').expect(200);
    const expired = jwt.sign({ sub: body.id, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET!);
    await http().get('/api/auth/me').set('Cookie', `${COOKIE}=${expired}`).expect(401);
    const wrongKey = jwt.sign({ sub: body.id }, 'not-the-secret');
    await http().get('/api/auth/me').set('Cookie', `${COOKIE}=${wrongKey}`).expect(401);
    await http().get('/api/auth/me').set('Cookie', `${cookieFor(body.id)}x`).expect(401);
    await http().get('/api/auth/me').set('Cookie', cookieFor('00000000-0000-0000-0000-000000000000')).expect(401);
  });

  it('a valid minted cookie returns 200 and the user', async () => {
    const res = await (await ownerAgent(app)).get('/api/auth/me').expect(200);
    expect(res.body).toMatchObject({ email: process.env.ALLOWED_EMAILS!.split(',')[0].trim().toLowerCase() });
  });

  it('logout clears the cookie', async () => {
    const res = await http().post('/api/auth/logout').expect(204);
    expect(res.headers['set-cookie'][0]).toMatch(new RegExp(`^${COOKIE}=;.*(Expires=Thu, 01 Jan 1970|Max-Age=0)`));
  });

  it('the Google login routes are public (redirect, not 401)', async () => {
    await http().get('/api/auth/google').expect(302);
  });
});
