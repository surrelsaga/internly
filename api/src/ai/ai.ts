import { BadGatewayException, Body, Controller, Injectable, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { Internship } from '../internship/internship.entity.js';
import { User } from '../users/user.entity.js';

const PROMPT =
  'Improve the clarity and grammar of the user\'s text. Keep its meaning and its first person voice. Do not add facts. ' +
  'Keep any "[redacted]" markers as they are. Reply with the improved text only, no preamble or quotes.';

export const FRIENDLY_ERROR = 'The AI could not refine this text right now. Your text is unchanged, try again in a moment.';

const list = (s?: string) => (s ?? '').split(',').map((t) => t.trim()).filter(Boolean);

// Replaces each term (case-insensitive, literal) with [redacted]. Longest first, so "Acme Corp" wins over "Acme".
export function redact(text: string, terms: string[]) {
  const clean = terms.map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!clean.length) return text;
  const re = new RegExp(clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  return text.replace(re, '[redacted]');
}

@Injectable()
export class AiService {
  // Tries each model in order; null if none gives a non-empty reply. Reads env per call so tests can change it.
  async refine(text: string): Promise<string | null> {
    for (const model of list(process.env.OPENROUTER_MODELS)) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: PROMPT }, { role: 'user', content: text }] }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
        const out = data.choices?.[0]?.message?.content;
        if (typeof out === 'string' && out.trim()) return out.trim();
      } catch {
        // network error, timeout or bad JSON: next model
      }
    }
    return null;
  }
}

class RefineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text: string;
}

@Controller('ai')
export class AiController {
  constructor(
    private ds: DataSource,
    private ai: AiService,
  ) {}

  // Reads only; nothing is saved. The UI applies the suggestion through the normal save endpoints.
  @Post('refine')
  async refine(@CurrentUser() user: User, @Body() dto: RefineDto) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    const terms = [...list(process.env.AI_REDACT_TERMS), ...(internship ? [internship.company] : [])];
    const suggestion = await this.ai.refine(redact(dto.text, terms));
    if (!suggestion) throw new BadGatewayException(FRIENDLY_ERROR);
    return { suggestion };
  }
}
