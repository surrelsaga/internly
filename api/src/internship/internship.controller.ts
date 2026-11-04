import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { DataSource, In } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { Note } from '../notes/note.entity.js';
import { pickReflection } from '../reflection/reflection.controller.js';
import { Reflection } from '../reflection/reflection.entity.js';
import { ownedWeek, weekTasks } from '../tasks/queries.js';
import { User } from '../users/user.entity.js';
import { Internship, Week } from './internship.entity.js';
import { currentWeek, generateWeeks, lockedWeek } from './weeks.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isRealDay = (s: string) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const MAX_WEEKS = 120;

class CreateInternshipDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  company: string;

  @Matches(DAY)
  startDate: string;

  @Matches(DAY)
  endDate: string;
}

// A uuid that matches nothing is a 404, not a 400.
const weekId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller()
export class InternshipController {
  constructor(private ds: DataSource) {}

  @Post('internship')
  async create(@CurrentUser() user: User, @Body() dto: CreateInternshipDto) {
    if (!isRealDay(dto.startDate) || !isRealDay(dto.endDate)) throw new BadRequestException('Not a real date');
    if (dto.endDate <= dto.startDate) throw new BadRequestException('End must come after start');
    const spans = generateWeeks(dto.startDate, dto.endDate);
    if (spans.length > MAX_WEEKS) throw new BadRequestException('Internship is too long');

    if (await this.ds.getRepository(Internship).existsBy({ userId: user.id })) {
      throw new ConflictException('Internship already set up');
    }
    // Backfill = weeks before the current one (or none if it hasn't started).
    const trackingStartDate = currentWeek(spans, new Date()).startDate;
    await this.ds.transaction(async (m) => {
      const internship = await m.save(Internship, { ...dto, userId: user.id, trackingStartDate, lastEmailedWeekId: null });
      await m.insert(Week, spans.map((s) => ({ ...s, internshipId: internship.id })));
    });
    return this.get(user);
  }

  @Get('internship')
  async get(@CurrentUser() user: User) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    if (!internship) throw new NotFoundException();
    const weeks = await this.ds.getRepository(Week).find({ where: { internshipId: internship.id }, order: { number: 'ASC' } });
    // reflected = "What I learnt" is not blank
    const reflections = await this.ds.getRepository(Reflection).find({ select: { weekId: true, learnt: true }, where: { weekId: In(weeks.map((w) => w.id)) } });
    const reflected = new Set(reflections.filter((r) => r.learnt.trim()).map((r) => r.weekId));
    return { ...internship, weeks: weeks.map((w) => ({ ...w, reflected: reflected.has(w.id) })) };
  }

  // Declared before :id so ':id' doesn't swallow it.
  @Get('weeks/current')
  async current(@CurrentUser() user: User) {
    const { weeks, trackingStartDate } = await this.get(user);
    const reflections = await this.ds.getRepository(Reflection).find({ select: { weekId: true, learnt: true }, where: { weekId: In(weeks.map((w) => w.id)) } });
    const now = new Date();
    const locked = lockedWeek(weeks, reflections, trackingStartDate, now);
    return { ...(locked ?? currentWeek(weeks, now)), locked: !!locked };
  }

  @Get('weeks/:id')
  async week(@CurrentUser() user: User, @Param('id', weekId) id: string) {
    const week = await ownedWeek(this.ds, user.id, id);
    if (!week) throw new NotFoundException();
    const reflection = await this.ds.getRepository(Reflection).findOneBy({ weekId: week.id });
    const notes = await this.ds.getRepository(Note).find({ where: { weekId: week.id }, order: { type: 'ASC', position: 'ASC' } });
    return { ...week, tasks: await weekTasks(this.ds, week), reflection: pickReflection(reflection), notes };
  }
}
