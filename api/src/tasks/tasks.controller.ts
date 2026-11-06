import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { User } from '../users/user.entity.js';
import { Task } from './task.entity.js';
import { ownedTask, ownedWeek } from './queries.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CreateTaskDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsUUID()
  weekId: string;
}

class UpdateTaskDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsUUID()
  weekId?: string;
}

// A uuid that matches nothing is a 404, not a 400.
const taskId = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('tasks')
export class TasksController {
  constructor(private ds: DataSource) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateTaskDto) {
    const week = await ownedWeek(this.ds, user.id, dto.weekId);
    if (!week) throw new NotFoundException();
    return this.ds.getRepository(Task).save({ internshipId: week.internshipId, title: dto.title, createdWeekId: week.id, doneWeekId: null });
  }

  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id', taskId) id: string, @Body() dto: UpdateTaskDto) {
    const task = await ownedTask(this.ds, user.id, id);
    if (!task) throw new NotFoundException();

    if (dto.title !== undefined && dto.done === undefined) {
      task.title = dto.title;
    } else if (dto.done === true && dto.title === undefined) {
      if (!dto.weekId) throw new BadRequestException('weekId is required to check a task');
      const [week, created] = await Promise.all([ownedWeek(this.ds, user.id, dto.weekId), ownedWeek(this.ds, user.id, task.createdWeekId)]);
      if (!week) throw new NotFoundException();
      if (week.number < created!.number) throw new BadRequestException('Cannot check a task before the week it was created');
      task.doneWeekId = week.id;
    } else if (dto.done === false && dto.title === undefined) {
      task.doneWeekId = null;
    } else {
      throw new BadRequestException('Send either a title or done');
    }
    return this.ds.getRepository(Task).save(task);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id', taskId) id: string) {
    const task = await ownedTask(this.ds, user.id, id);
    if (!task) throw new NotFoundException();
    await this.ds.getRepository(Task).delete(task.id);
  }
}
