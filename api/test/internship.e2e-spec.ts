import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ownerAgent } from './auth.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { User } from '../src/users/user.entity.js';

describe('internship (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const http = () => agent;
  const body = { company: 'Speedback', startDate: '2026-10-07', endDate: '2026-11-29' };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
  });

  afterAll(() => app.close());

  it('GET /api/internship is 404 before setup', async () => {
    await http().get('/api/internship').expect(404);
    await http().get('/api/weeks/current').expect(404);
  });

  it('rejects bad input', async () => {
    await http().post('/api/internship').send({ ...body, company: '  ' }).expect(400);
    await http().post('/api/internship').send({ ...body, startDate: '07/10/2026' }).expect(400);
    await http().post('/api/internship').send({ ...body, endDate: '2026-02-30' }).expect(400);
    await http().post('/api/internship').send({ ...body, endDate: body.startDate }).expect(400);
    await http().get('/api/internship').expect(404);
  });

  it('POST creates the internship and its weeks, GET returns them', async () => {
    const created = await http().post('/api/internship').send(body).expect(201);
    expect(created.body.weeks).toHaveLength(8);

    const { body: got } = await http().get('/api/internship').expect(200);
    expect(got.company).toBe('Speedback');
    expect(got.weeks).toHaveLength(8);
    expect(got.weeks[0]).toMatchObject({ number: 1, startDate: '2026-10-05', endDate: '2026-10-11' });
    expect(got.weeks[7]).toMatchObject({ number: 8, startDate: '2026-11-23', endDate: '2026-11-29' });
    expect(got.trackingStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(got.lastEmailedWeekId).toBeNull();
  });

  it('a second POST is 409', async () => {
    await http().post('/api/internship').send(body).expect(409);
  });

  it('GET /api/weeks/current returns one of the weeks', async () => {
    const { body: got } = await http().get('/api/internship');
    const { body: cur } = await http().get('/api/weeks/current').expect(200);
    expect(got.weeks.map((w: { id: string }) => w.id)).toContain(cur.id);
  });

  it('GET /api/weeks/:id returns the week, 404 for unknown or other users', async () => {
    const { body: got } = await http().get('/api/internship');
    await http().get(`/api/weeks/${got.weeks[2].id}`).expect(200).expect((r) => expect(r.body.number).toBe(3));

    await http().get('/api/weeks/00000000-0000-4000-8000-000000000000').expect(404);
    await http().get('/api/weeks/nope').expect(404);

    const ds = app.get(DataSource);
    const other = await ds.getRepository(User).save({ email: 'other@example.com', name: 'other', googleId: null });
    const i = await ds.getRepository(Internship).save({
      userId: other.id,
      company: 'Other',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      trackingStartDate: '2026-10-05',
      lastEmailedWeekId: null,
    });
    const w = await ds.getRepository(Week).save({ internshipId: i.id, number: 1, startDate: '2026-10-05', endDate: '2026-10-11' });
    await http().get(`/api/weeks/${w.id}`).expect(404);
  });
});
