import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { WeeklyEmail } from './email/email.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.setGlobalPrefix('api');
// Render terminates TLS in front of us; trust it so secure cookies and req.protocol work.
app.set('trust proxy', 1);

// ponytail: plain express static + SPA fallback instead of @nestjs/serve-static (one less dependency).
const web = fileURLToPath(new URL('../../web/dist/', import.meta.url));
app.useStaticAssets(web);
app.use((req: { method: string; path: string }, res: { sendFile(p: string): void }, next: () => void) => {
  if (req.method === 'GET' && req.path !== '/api' && !req.path.startsWith('/api/')) res.sendFile(`${web}index.html`);
  else next();
});

await app.listen(process.env.PORT ?? 3000);
// A Friday email missed while the server was down goes out now. Not in AppModule, so tests never trigger it.
await app.get(WeeklyEmail).sendDue();
