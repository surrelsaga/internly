import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ownerAgent } from './auth.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Internship } from '../src/internship/internship.entity.js';
import { mondayOf, singaporeDay } from '../src/internship/weeks.js';

describe('reflection lock (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const http = () => agent;
  const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
  });

  afterAll(() => app.close());

  it('returns last week while it is unreflected, then the current week after a PUT', async () => {
    // Weeks: two ago, last week, this week, next week. Tracking began two weeks ago, so last week can lock.
    const monday = mondayOf(singaporeDay(new Date()));
    const { body } = await http().post('/api/internship').send({ company: 'Speedback', startDate: shift(monday, -14), endDate: shift(monday, 13) }).expect(201);
    await app.get(DataSource).getRepository(Internship).update(body.id, { trackingStartDate: body.weeks[0].startDate });
    const [, last, current] = body.weeks;

    const locked = await http().get('/api/weeks/current').expect(200);
    expect(locked.body).toMatchObject({ id: last.id, locked: true });

    await http().put(`/api/weeks/${last.id}/reflection`).send({ learnt: '   ' }).expect(200);
    expect((await http().get('/api/weeks/current').expect(200)).body).toMatchObject({ id: last.id, locked: true });

    await http().put(`/api/weeks/${last.id}/reflection`).send({ learnt: 'how locks work' }).expect(200);
    expect((await http().get('/api/weeks/current').expect(200)).body).toMatchObject({ id: current.id, locked: false });
  });
});
