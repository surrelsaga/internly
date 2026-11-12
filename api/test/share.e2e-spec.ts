import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ownerAgent } from './auth.js';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { User } from '../src/users/user.entity.js';

describe('share link (e2e)', () => {
  let app: INestApplication;
  let weeks: { id: string }[];
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  // A visitor: no login cookie.
  const anon = () => request(app.getHttpServer());

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
    const { body } = await agent.post('/api/internship').send({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-01' }).expect(201);
    weeks = body.weeks;
  });

  afterAll(() => app.close());

  it('is off until turned on', async () => {
    const { body } = await agent.get('/api/internship').expect(200);
    expect(body).toMatchObject({ shareToken: null, shareEnabled: false });
    await agent.put('/api/share').send({ enabled: 'yes' }).expect(400);
    await anon().put('/api/share').send({ enabled: true }).expect(401);
  });

  it('concurrent first enables return the same working link', async () => {
    const [first, second] = await Promise.all([
      agent.put('/api/share').send({ enabled: true }).expect(200),
      agent.put('/api/share').send({ enabled: true }).expect(200),
    ]);
    expect(first.body).toMatchObject({ shareToken: expect.stringMatching(/^[\w-]{32}$/), shareEnabled: true });
    expect(second.body).toEqual(first.body);
    await anon().get(`/api/shared/${first.body.shareToken}`).expect(200);
  });

  it('a visitor sees the latest notes, tasks and reflection, and the link stays the same', async () => {
    const { body: on } = await agent.put('/api/share').send({ enabled: true }).expect(200);
    expect(on.shareEnabled).toBe(true);
    expect(on.shareToken).toMatch(/^[\w-]{32}$/);
    const token = on.shareToken;

    const { body: shared } = await anon().get(`/api/shared/${token}`).expect(200);
    expect(shared).toMatchObject({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-01' });
    expect(shared.weeks).toHaveLength(4);
    // nothing private
    expect(Object.keys(shared).sort()).toEqual(['company', 'endDate', 'name', 'reflectionPosition', 'sections', 'startDate', 'weeks']);

    // Changes made after sharing show up on the same link.
    const sectionId = (await agent.post('/api/sections').send({ name: 'dev' }).expect(201)).body.id;
    const { body: note } = await agent.post(`/api/weeks/${weeks[0].id}/notes`).send({ sectionId, title: 'first' }).expect(201);
    await agent.post('/api/tasks').send({ title: 'ship it', weekId: weeks[0].id }).expect(201);
    await agent.put(`/api/weeks/${weeks[0].id}/reflection`).send({ learnt: 'a lot' }).expect(200);

    expect((await anon().get(`/api/shared/${token}`).expect(200)).body.sections).toMatchObject([{ id: sectionId, name: 'dev' }]);
    const { body: week } = await anon().get(`/api/shared/${token}/weeks/${weeks[0].id}`).expect(200);
    expect(week.notes).toMatchObject([{ id: note.id, title: 'first' }]);
    expect(week.tasks).toMatchObject([{ title: 'ship it', done: false }]);
    expect(week.reflection).toEqual({ learnt: 'a lot', wentWell: '', needHelp: '' });

    // Off: the link stops working. On again: the same link works again.
    await agent.put('/api/share').send({ enabled: false }).expect(200);
    await anon().get(`/api/shared/${token}`).expect(404);
    await anon().get(`/api/shared/${token}/weeks/${weeks[0].id}`).expect(404);
    const { body: again } = await agent.put('/api/share').send({ enabled: true }).expect(200);
    expect(again.shareToken).toBe(token);
    await anon().get(`/api/shared/${token}`).expect(200);
  });

  it('a visitor cannot change anything', async () => {
    const { body: week } = await agent.get(`/api/weeks/${weeks[0].id}`).expect(200);
    const note = week.notes[0];
    await anon().patch(`/api/notes/${note.id}`).send({ title: 'hacked' }).expect(401);
    await anon().put(`/api/weeks/${weeks[0].id}/reflection`).send({ learnt: 'hacked' }).expect(401);
    await anon().post('/api/tasks').send({ title: 'hacked', weekId: weeks[0].id }).expect(401);
    await anon().get(`/api/weeks/${weeks[0].id}`).expect(401);
  });

  it("unknown tokens and other internships' weeks are 404", async () => {
    const token = (await agent.get('/api/internship').expect(200)).body.shareToken;
    await anon().get('/api/shared/not-a-real-token').expect(404);
    await anon().get(`/api/shared/${token}/weeks/nope`).expect(404);

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
    await anon().get(`/api/shared/${token}/weeks/${w.id}`).expect(404);
  });
});
