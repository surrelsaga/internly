import { Body, Controller, Delete, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { Internship, Week } from '../internship/internship.entity.js';
import { ownedWeek } from '../tasks/queries.js';
import { User } from '../users/user.entity.js';
import { Note, type NoteType } from './note.entity.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CreateNoteDto {
  @IsIn(['dev', 'research'])
  type: NoteType;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title: string;
}

class UpdateNoteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: object;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

// A uuid that matches nothing is a 404, not a 400.
const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

// The note if it belongs to this user's internship, otherwise null.
function ownedNote(ds: DataSource, userId: string, id: string) {
  return ds
    .getRepository(Note)
    .createQueryBuilder('n')
    .innerJoin(Week, 'w', 'w.id = n.weekId')
    .innerJoin(Internship, 'i', 'i.id = w.internshipId')
    .where('n.id = :id AND i.userId = :userId', { id, userId })
    .getOne();
}

@Controller()
export class NotesController {
  constructor(private ds: DataSource) {}

  @Post('weeks/:id/notes')
  async create(@CurrentUser() user: User, @Param('id', uuid) id: string, @Body() dto: CreateNoteDto) {
    const week = await ownedWeek(this.ds, user.id, id);
    if (!week) throw new NotFoundException();
    const repo = this.ds.getRepository(Note);
    const row = await repo
      .createQueryBuilder('n')
      .select('max(n.position)', 'max')
      .where('n.weekId = :id AND n.type = :type', { id, type: dto.type })
      .getRawOne<{ max: number | null }>();
    // ponytail: max + 1 isn't atomic. Two simultaneous creates could share a position; it's one person's journal.
    return repo.save({
      weekId: id,
      type: dto.type,
      title: dto.title || 'untitled',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      position: row?.max == null ? 0 : row.max + 1,
    });
  }

  @Patch('notes/:id')
  async update(@CurrentUser() user: User, @Param('id', uuid) id: string, @Body() dto: UpdateNoteDto) {
    const note = await ownedNote(this.ds, user.id, id);
    if (!note) throw new NotFoundException();
    return this.ds.getRepository(Note).save(Object.assign(note, dto));
  }

  @Delete('notes/:id')
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id', uuid) id: string) {
    const note = await ownedNote(this.ds, user.id, id);
    if (!note) throw new NotFoundException();
    await this.ds.getRepository(Note).delete(note.id);
  }
}
