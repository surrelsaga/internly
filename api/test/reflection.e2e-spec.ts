import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ownerAgent } from './auth.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { Reflection } from '../src/reflection/reflection.entity.js';
import { User } from '../src/users/user.entity.js';

describe('reflection (e2e)', () => {
  let app: INestApplication;
  let weeks: { id: string }[];
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  const http = () => agent;
  const put = (n: number, body: object) => http().put(`/api/weeks/${weeks[n].id}/reflection`).send(body);
  const reflected = async () => (await http().get('/api/internship').expect(200)).body.weeks.map((w: { reflected: boolean }) => w.reflected);

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
    const { body } = await http().post('/api/internship').send({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-01' }).expect(201);
    weeks = body.weeks;
  });

  afterAll(() => app.close());

  it('starts empty, the first save creates the row and the second updates it', async () => {
    const empty = { learnt: '', wentWell: '', needHelp: '' };
    expect((await http().get(`/api/weeks/${weeks[0].id}`).expect(200)).body.reflection).toEqual(empty);

    await put(0, { learnt: 'one' }).expect(200);
    await put(0, { learnt: 'two' }).expect(200);
    const rows = await app.get(DataSource).getRepository(Reflection).findBy({ weekId: weeks[0].id });
    expect(rows).toMatchObject([{ learnt: 'two' }]);
    expect((await http().get(`/api/weeks/${weeks[0].id}`).expect(200)).body.reflection).toEqual({ ...empty, learnt: 'two' });
  });

  it("saving one field doesn't clear the others", async () => {
    await put(1, { learnt: 'L', wentWell: 'W' }).expect(200);
    const { body } = await put(1, { needHelp: 'H' }).expect(200);
    expect(body).toEqual({ learnt: 'L', wentWell: 'W', needHelp: 'H' });
    const { body: again } = await put(1, { wentWell: '' }).expect(200);
    expect(again).toEqual({ learnt: 'L', wentWell: '', needHelp: 'H' });
  });

  it('a week counts as reflected only when learnt is not blank', async () => {
    await put(2, { wentWell: 'only this' }).expect(200);
    await put(3, { learnt: '   ' }).expect(200);
    expect((await reflected()).slice(0, 4)).toEqual([true, true, false, false]);
  });

  it('rejects bad input', async () => {
    await put(0, { learnt: 5 }).expect(400);
    await http().put('/api/weeks/nope/reflection').send({}).expect(404);
  });

  it("another user's week is 404", async () => {
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
    await http().put(`/api/weeks/${w.id}/reflection`).send({ learnt: 'x' }).expect(404);
    expect(await ds.getRepository(Reflection).countBy({ weekId: w.id })).toBe(0);
  });
});
