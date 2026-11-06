import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ownerAgent } from './auth.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { Task } from '../src/tasks/task.entity.js';
import { User } from '../src/users/user.entity.js';

describe('tasks (e2e)', () => {
  let app: INestApplication;
  let weeks: { id: string; number: number }[];
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const http = () => agent;
  const tasksIn = async (n: number) => (await http().get(`/api/weeks/${weeks[n - 1].id}`).expect(200)).body.tasks;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
    const { body } = await http().post('/api/internship').send({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-29' }).expect(201);
    weeks = body.weeks;
  });

  afterAll(() => app.close());

  it('adding a task in a backfill week works and the task carries forward', async () => {
    await http().post('/api/tasks').send({ title: '  Write docs ', weekId: weeks[0].id }).expect(201);
    expect(await tasksIn(1)).toMatchObject([{ title: 'Write docs', done: false, fromWeek: null }]);
    expect(await tasksIn(3)).toMatchObject([{ title: 'Write docs', done: false, fromWeek: 1 }]);
    expect(await tasksIn(8)).toHaveLength(1);
  });

  it('ticking marks it done only in that week, unticking brings it back', async () => {
    const [{ id }] = await tasksIn(1);
    await http().patch(`/api/tasks/${id}`).send({ done: true, weekId: weeks[2].id }).expect(200);
    expect(await tasksIn(2)).toMatchObject([{ done: false }]);
    expect(await tasksIn(3)).toMatchObject([{ done: true, fromWeek: 1 }]);
    expect(await tasksIn(4)).toEqual([]);

    await http().patch(`/api/tasks/${id}`).send({ done: false }).expect(200);
    expect(await tasksIn(4)).toMatchObject([{ done: false, fromWeek: 1 }]);
  });

  it('edits the title and rejects bad input', async () => {
    const [{ id }] = await tasksIn(1);
    await http().patch(`/api/tasks/${id}`).send({ title: 'Write more docs' }).expect(200);
    expect((await tasksIn(1))[0].title).toBe('Write more docs');

    await http().patch(`/api/tasks/${id}`).send({ title: ' ' }).expect(400);
    await http().patch(`/api/tasks/${id}`).send({}).expect(400);
    await http().patch(`/api/tasks/${id}`).send({ done: true }).expect(400);
    await http().post('/api/tasks').send({ title: '', weekId: weeks[0].id }).expect(400);
    // cannot be ticked before the week it was created
    const { body } = await http().post('/api/tasks').send({ title: 'Later', weekId: weeks[4].id }).expect(201);
    await http().patch(`/api/tasks/${body.id}`).send({ done: true, weekId: weeks[1].id }).expect(400);
  });

  it('deleting a task removes it from every week', async () => {
    const [{ id }] = await tasksIn(1);
    await http().delete(`/api/tasks/${id}`).expect(204);
    for (const n of [1, 2, 8]) expect((await tasksIn(n)).map((t: { id: string }) => t.id)).not.toContain(id);
    await http().delete(`/api/tasks/${id}`).expect(404);
  });

  it('restoring a deleted task brings it back exactly as it was', async () => {
    const { body: a } = await http().post('/api/tasks').send({ title: 'Restore me', weekId: weeks[1].id }).expect(201);
    await http().post('/api/tasks').send({ title: 'After it', weekId: weeks[1].id }).expect(201);
    await http().patch(`/api/tasks/${a.id}`).send({ done: true, weekId: weeks[2].id }).expect(200);
    const before = await Promise.all([1, 2, 3].map(tasksIn));

    await http().delete(`/api/tasks/${a.id}`).expect(204);
    // gone everywhere, and can't be edited while deleted
    for (const n of [1, 2, 3]) expect((await tasksIn(n)).map((t: { id: string }) => t.id)).not.toContain(a.id);
    await http().patch(`/api/tasks/${a.id}`).send({ title: 'x' }).expect(404);

    const { body } = await http().post(`/api/tasks/${a.id}/restore`).expect(200);
    expect(body).toMatchObject({ id: a.id, title: 'Restore me', createdWeekId: weeks[1].id, doneWeekId: weeks[2].id, deletedAt: null });
    // same weeks, same checked state, same place in the list
    expect(await Promise.all([1, 2, 3].map(tasksIn))).toEqual(before);
    // restoring again is a no-op
    await http().post(`/api/tasks/${a.id}/restore`).expect(200);
    expect(await tasksIn(2)).toEqual(before[1]);
  });

  it("another user's internship is 404", async () => {
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
    const t = await ds.getRepository(Task).save({ internshipId: i.id, title: 'Theirs', createdWeekId: w.id, doneWeekId: null });

    await http().post('/api/tasks').send({ title: 'x', weekId: w.id }).expect(404);
    await http().patch(`/api/tasks/${t.id}`).send({ title: 'mine now' }).expect(404);
    await http().patch(`/api/tasks/${t.id}`).send({ done: false }).expect(404);
    await http().delete(`/api/tasks/${t.id}`).expect(404);
    await http().delete('/api/tasks/nope').expect(404);
    await ds.getRepository(Task).softDelete(t.id);
    await http().post(`/api/tasks/${t.id}/restore`).expect(404);
    await ds.getRepository(Task).restore(t.id);
    expect(await ds.getRepository(Task).findOneBy({ id: t.id })).toMatchObject({ title: 'Theirs' });

    // my own task can't be ticked into their week
    const { body: mine } = await http().post('/api/tasks').send({ title: 'Mine', weekId: weeks[0].id }).expect(201);
    await http().patch(`/api/tasks/${mine.id}`).send({ done: true, weekId: w.id }).expect(404);
  });
});
