import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ownerAgent } from './auth.js';
import { AppModule } from '../src/app.module.js';
import { Internship } from '../src/internship/internship.entity.js';
import { Section } from '../src/notes/note.entity.js';
import { User } from '../src/users/user.entity.js';

describe('sections (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  let weekId: string;
  const sections = async () => (await agent.get('/api/internship').expect(200)).body.sections;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
  });

  afterAll(() => app.close());

  it('needs an internship first', async () => {
    await agent.post('/api/sections').send({ name: 'dev notes' }).expect(404);
  });

  it('a new internship starts with no tabs', async () => {
    const { body } = await agent.post('/api/internship').send({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-01' }).expect(201);
    expect(body.sections).toEqual([]);
    weekId = body.weeks[0].id;
  });

  it('adds, renames and lists tabs in order', async () => {
    const { body: a } = await agent.post('/api/sections').send({ name: '  meetings  ' }).expect(201);
    expect(a).toEqual({ id: a.id, name: 'meetings', position: 0 });
    const { body: b } = await agent.post('/api/sections').send({ name: 'reading' }).expect(201);
    expect(b.position).toBe(1);

    await agent.post('/api/sections').send({ name: '   ' }).expect(400);
    await agent.post('/api/sections').send({ name: 'x'.repeat(41) }).expect(400);
    await agent.patch(`/api/sections/${a.id}`).send({ name: '' }).expect(400);

    expect((await agent.patch(`/api/sections/${a.id}`).send({ name: 'standups' }).expect(200)).body).toEqual({ id: a.id, name: 'standups', position: 0 });
    expect(await sections()).toEqual([
      { id: a.id, name: 'standups', position: 0 },
      { id: b.id, name: 'reading', position: 1 },
    ]);
  });

  it('reorders tabs, only with every tab listed once', async () => {
    const [a, b] = await sections();
    await agent.put('/api/sections/order').send({ ids: [a.id] }).expect(400);
    await agent.put('/api/sections/order').send({ ids: [a.id, a.id] }).expect(400);
    await agent.put('/api/sections/order').send({ ids: [a.id, b.id, '00000000-0000-4000-8000-000000000000'] }).expect(400);
    await agent.put('/api/sections/order').send({ ids: 'nope' }).expect(400);

    await agent.put('/api/sections/order').send({ ids: [b.id, a.id] }).expect(200);
    expect((await sections()).map((s: { name: string; position: number }) => [s.name, s.position])).toEqual([
      ['reading', 0],
      ['standups', 1],
    ]);
    // a tab added later goes on the end
    const { body: c } = await agent.post('/api/sections').send({ name: 'later' }).expect(201);
    expect(c.position).toBe(2);
    await agent.delete(`/api/sections/${c.id}`).expect(204);
  });

  it('deletes an empty tab, and a tab with notes only with force', async () => {
    const [reading, standups] = await sections();
    await agent.delete(`/api/sections/${reading.id}`).expect(204);

    await agent.post(`/api/weeks/${weekId}/notes`).send({ sectionId: standups.id, title: 'mon' }).expect(201);
    const { body } = await agent.delete(`/api/sections/${standups.id}`).expect(409);
    expect(body.message).toBe('This tab has 1 note across your weeks.');
    await agent.delete(`/api/sections/${standups.id}?force=true`).expect(204);

    expect(await sections()).toEqual([]);
    expect((await agent.get(`/api/weeks/${weekId}`).expect(200)).body.notes).toEqual([]);
  });

  it("another user's tab is 404", async () => {
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
    const s = await ds.getRepository(Section).save({ internshipId: i.id, name: 'secret', position: 0 });

    await agent.patch(`/api/sections/${s.id}`).send({ name: 'mine now' }).expect(404);
    await agent.delete(`/api/sections/${s.id}?force=true`).expect(404);
    await agent.put('/api/sections/order').send({ ids: [s.id] }).expect(400);
    await agent.patch('/api/sections/not-a-uuid').send({ name: 'x' }).expect(404);
    expect(await ds.getRepository(Section).findOneByOrFail({ id: s.id })).toMatchObject({ name: 'secret' });
  });
});

describe('sections migration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ({ dataSource: ds } = await import('../src/data-source.js'));
    await ds.initialize();
  });

  afterAll(async () => {
    // leave the schema migrated for the next file
    await ds.runMigrations();
    await ds.destroy();
  });

  it('gives existing internships "dev notes" and "research notes" and moves their notes there', async () => {
    await ds.query(`truncate "internships" cascade`);
    await ds.undoLastMigration(); // back to notes.type
    const [{ id: userId }] = await ds.query(`select id from users limit 1`);
    const [{ id: iid }] = await ds.query(
      `insert into internships ("userId", company, "startDate", "endDate", "trackingStartDate") values ($1, 'Old', '2026-10-05', '2026-10-11', '2026-10-05') returning id`,
      [userId],
    );
    const [{ id: wid }] = await ds.query(`insert into weeks ("internshipId", number, "startDate", "endDate") values ($1, 1, '2026-10-05', '2026-10-11') returning id`, [iid]);
    await ds.query(
      `insert into notes ("weekId", type, title, content, position) values ($1, 'dev', 'd', '{}', 0), ($1, 'research', 'r', '{}', 0), ($1, 'dev', 'd2', '{}', 1)`,
      [wid],
    );

    await ds.runMigrations();

    const sections = await ds.query(`select id, name, position from sections where "internshipId" = $1 order by position`, [iid]);
    expect(sections.map((s: { name: string; position: number }) => [s.name, s.position])).toEqual([
      ['dev notes', 0],
      ['research notes', 1],
    ]);
    const tab = Object.fromEntries(sections.map((s: { id: string; name: string }) => [s.id, s.name]));
    const notes = await ds.query(`select title, position, "sectionId" from notes order by title`);
    expect(notes.map((n: { title: string; position: number; sectionId: string }) => [n.title, tab[n.sectionId], n.position])).toEqual([
      ['d', 'dev notes', 0],
      ['d2', 'dev notes', 1],
      ['r', 'research notes', 0],
    ]);
  });
});
