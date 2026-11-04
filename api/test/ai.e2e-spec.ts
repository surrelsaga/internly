import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { vi } from 'vitest';
import { ownerAgent } from './auth.js';
import { AppModule } from '../src/app.module.js';
import { FRIENDLY_ERROR } from '../src/ai/ai.js';

const reply = (content: string, ok = true) => ({ ok, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe('ai refine (e2e)', () => {
  let app: INestApplication;
  let agent: Awaited<ReturnType<typeof ownerAgent>>;
  let weekId: string;
  const fetchMock = vi.fn();
  const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body).messages[1].content as string;

  beforeAll(async () => {
    process.env.OPENROUTER_MODELS = 'model-a,model-b';
    process.env.AI_REDACT_TERMS = 'Project Falcon, ,';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    agent = await ownerAgent(app);
    const { body } = await agent.post('/api/internship').send({ company: 'Speedback', startDate: '2026-10-05', endDate: '2026-11-01' }).expect(201);
    weekId = body.weeks[0].id;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => app.close());

  it('needs a login', async () => {
    await request(app.getHttpServer()).post('/api/ai/refine').send({ text: 'hi' }).expect(401);
  });

  it('redacts the company and the extra terms before sending, and returns the suggestion', async () => {
    fetchMock.mockResolvedValueOnce(reply('I learnt a lot at [redacted] on [redacted].'));
    const { body } = await agent.post('/api/ai/refine').send({ text: 'i learnt alot at SPEEDBACK on project falcon.' }).expect(201);
    expect(body).toEqual({ suggestion: 'I learnt a lot at [redacted] on [redacted].' });
    expect(sent()).toBe('i learnt alot at [redacted] on [redacted].');
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('falls through to the next model', async () => {
    fetchMock.mockResolvedValueOnce(reply('', false)).mockResolvedValueOnce(reply('fine'));
    const { body } = await agent.post('/api/ai/refine').send({ text: 'text' }).expect(201);
    expect(body.suggestion).toBe('fine');
  });

  it('answers 502 with a friendly message when every model fails, and saves nothing', async () => {
    fetchMock.mockResolvedValue(reply('', false));
    const before = (await agent.get(`/api/weeks/${weekId}`).expect(200)).body;
    const { body } = await agent.post('/api/ai/refine').send({ text: 'text' }).expect(502);
    expect(body.message).toBe(FRIENDLY_ERROR);
    fetchMock.mockResolvedValue(reply('better'));
    await agent.post('/api/ai/refine').send({ text: 'text' }).expect(201);
    // a successful refine writes nothing either
    expect((await agent.get(`/api/weeks/${weekId}`).expect(200)).body).toEqual(before);
  });

  it('rejects empty, missing and over-long text without calling the AI', async () => {
    await agent.post('/api/ai/refine').send({ text: '' }).expect(400);
    await agent.post('/api/ai/refine').send({}).expect(400);
    await agent.post('/api/ai/refine').send({ text: 'x'.repeat(4001) }).expect(400);
    await agent.post('/api/ai/refine').send({ text: 'x'.repeat(4000) }).expect(502); // fetch mock returns undefined -> all models fail
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
