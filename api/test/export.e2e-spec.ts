import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ownerAgent } from './auth.js';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { Task } from '../src/tasks/task.entity.js';
import { User } from '../src/users/user.entity.js';

describe('export (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
  });

  afterAll(() => app.close());

  it('needs a login, and an internship', async () => {
    await request(app.getHttpServer()).get('/api/export').expect(401);
    await agent.get('/api/export').expect(404);
  });

  it('downloads tasks, reflection and notes as one Markdown file, and only my own', async () => {
    // Started in the past, so week 1 is always included.
    const { body } = await agent.post('/api/internship').send({ company: 'Speed Back', startDate: '2026-01-05', endDate: '2027-12-26' }).expect(201);
    const w1 = body.weeks[0].id;
    await agent.post('/api/tasks').send({ title: 'Ship login', weekId: w1 }).expect(201);
    const deleted = (await agent.post('/api/tasks').send({ title: 'Gone task', weekId: w1 }).expect(201)).body;
    await agent.delete(`/api/tasks/${deleted.id}`).expect(204);
    await agent.put(`/api/weeks/${w1}/reflection`).send({ learnt: 'SQL joins' }).expect(200);
    const section = (await agent.post('/api/sections').send({ name: 'dev notes' }).expect(201)).body;
    const note = (await agent.post(`/api/weeks/${w1}/notes`).send({ sectionId: section.id, title: 'whatsapp flow' }).expect(201)).body;
    const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'webhooks', marks: [{ type: 'bold' }] }] }] };
    await agent.patch(`/api/notes/${note.id}`).send({ content }).expect(200);

    // Someone else's internship, with a task that must not leak.
    const ds = app.get(DataSource);
    const other = await ds.getRepository(User).save({ email: 'other@example.com', name: 'other', googleId: null });
    const theirs = await ds.getRepository(Internship).save({ userId: other.id, company: 'Other Co', startDate: '2026-01-05', endDate: '2026-01-11', trackingStartDate: '2026-01-05', lastEmailedWeekId: null });
    const theirWeek = await ds.getRepository(Week).save({ internshipId: theirs.id, number: 1, startDate: '2026-01-05', endDate: '2026-01-11' });
    await ds.getRepository(Task).save({ internshipId: theirs.id, title: 'Secret task', createdWeekId: theirWeek.id, doneWeekId: null });

    const res = await agent.get('/api/export').expect(200);
    expect(res.headers['content-type']).toMatch(/^text\/markdown; charset=utf-8/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename=intern-log-speed-back-\d{4}-\d{2}-\d{2}\.md$/);
    const md = res.text;
    expect(md).toMatch(/^# Intern log: Speed Back\n/);
    expect(md).toContain('## Week 1 · Mon 5 Jan to Sun 11 Jan 2026\n\n### Tasks\n\n- [ ] Ship login');
    expect(md).toContain('### Reflection\n\n**What I learnt**\n\nSQL joins');
    expect(md).toContain('### dev notes\n\n#### whatsapp flow\n\n**webhooks**');
    expect(md).not.toContain('Gone task');
    expect(md).not.toContain('Secret task');
    expect(md).not.toContain('Other Co');
  });
});
