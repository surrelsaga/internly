import { Body, Controller, NotFoundException, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { ownedWeek } from '../tasks/queries.js';
import { User } from '../users/user.entity.js';
import { Reflection } from './reflection.entity.js';

class ReflectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  learnt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  wentWell?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  needHelp?: string;
}

export const pickReflection = (r: Reflection | null) => ({ learnt: r?.learnt ?? '', wentWell: r?.wentWell ?? '', needHelp: r?.needHelp ?? '' });

@Controller()
export class ReflectionController {
  constructor(private ds: DataSource) {}

  // Creates the row the first time, then updates only the fields sent.
  @Put('weeks/:id/reflection')
  async save(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 404 })) id: string, @Body() dto: ReflectionDto) {
    const week = await ownedWeek(this.ds, user.id, id);
    if (!week) throw new NotFoundException();
    const { learnt, wentWell, needHelp } = dto;
    const sent = Object.fromEntries(Object.entries({ learnt, wentWell, needHelp }).filter(([, v]) => v !== undefined));
    const repo = this.ds.getRepository(Reflection);
    await repo.upsert({ weekId: week.id, ...sent }, ['weekId']);
    return pickReflection(await repo.findOneByOrFail({ weekId: week.id }));
  }
}
