import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { ownerAgent } from './auth.js';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { Note } from '../src/notes/note.entity.js';
import { User } from '../src/users/user.entity.js';

vi.mock('../src/notes/cloudinary.js', () => ({ uploadToCloudinary: vi.fn(async () => 'https://res.cloudinary.test/pic.png') }));

describe('notes (e2e)', () => {
  let app: INestApplication;
  let weeks: { id: string }[];
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const create = (n: number, type: string, title: string) => agent.post(`/api/weeks/${weeks[n].id}/notes`).send({ type, title });
  const listed = async (n: number) => (await agent.get(`/api/weeks/${weeks[n].id}`).expect(200)).body.notes as { id: string; type: string; title: string; position: number }[];

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

  it('creates, updates and deletes a note', async () => {
    const { body: note } = await create(0, 'dev', 'whatsapp flow').expect(201);
    expect(note).toMatchObject({ weekId: weeks[0].id, type: 'dev', title: 'whatsapp flow', position: 0 });

    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] };
    const { body: updated } = await agent.patch(`/api/notes/${note.id}`).send({ title: 'renamed', content: doc }).expect(200);
    expect(updated).toMatchObject({ title: 'renamed', content: doc });
    expect(await listed(0)).toMatchObject([{ id: note.id, title: 'renamed', content: doc }]);

    await agent.patch(`/api/notes/${note.id}`).send({ title: 5 }).expect(400);
    await agent.patch(`/api/notes/${note.id}`).send({ content: 'nope' }).expect(400);
    await agent.patch(`/api/notes/${note.id}`).send({ content: null }).expect(400);
    await agent.patch(`/api/notes/${note.id}`).send({ title: null }).expect(400);
    await create(0, 'other', 'x').expect(400);

    await agent.delete(`/api/notes/${note.id}`).expect(204);
    expect(await listed(0)).toEqual([]);
    await agent.delete(`/api/notes/${note.id}`).expect(404);
  });

  it('keeps several notes per week and type in order', async () => {
    await create(1, 'research', 'r1').expect(201);
    await create(1, 'dev', 'd1').expect(201);
    await create(1, 'research', 'r2').expect(201);
    const { body: d2 } = await create(1, 'dev', 'd2').expect(201);
    await create(1, 'dev', 'd3').expect(201);

    const rows = await listed(1);
    expect(rows.map((n) => `${n.type}:${n.title}:${n.position}`)).toEqual(['dev:d1:0', 'dev:d2:1', 'dev:d3:2', 'research:r1:0', 'research:r2:1']);

    // another week starts its own order
    expect((await create(2, 'dev', 'first').expect(201)).body.position).toBe(0);

    // position can be changed
    await agent.patch(`/api/notes/${d2.id}`).send({ position: 9 }).expect(200);
    expect((await listed(1)).filter((n) => n.type === 'dev').map((n) => n.title)).toEqual(['d1', 'd3', 'd2']);
  });

  it("another user's week and notes are 404", async () => {
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
    const theirs = await ds.getRepository(Note).save({ weekId: w.id, type: 'dev', title: 'secret', content: { type: 'doc' }, position: 0 });

    await agent.post(`/api/weeks/${w.id}/notes`).send({ type: 'dev', title: 'x' }).expect(404);
    await agent.patch(`/api/notes/${theirs.id}`).send({ title: 'mine now' }).expect(404);
    await agent.delete(`/api/notes/${theirs.id}`).expect(404);
    await agent.get(`/api/weeks/${w.id}`).expect(404);
    expect(await ds.getRepository(Note).findOneByOrFail({ id: theirs.id })).toMatchObject({ title: 'secret' });
  });
});

describe('image upload (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
  });

  afterAll(() => app.close());

  it('returns the url for a valid image', async () => {
    const { body } = await agent.post('/api/uploads/image').attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    expect(body).toEqual({ url: 'https://res.cloudinary.test/pic.png' });
  });

  it('rejects non-images, a missing file and files over 5MB', async () => {
    await agent.post('/api/uploads/image').attach('file', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
    await agent.post('/api/uploads/image').field('x', 'y').expect(400);
    await agent
      .post('/api/uploads/image')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
  });

  it('needs a login', async () => {
    await agent.post('/api/uploads/image').set('Cookie', '').attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(401);
  });
});
