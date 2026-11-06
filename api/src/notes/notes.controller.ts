import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { Internship, Week } from '../internship/internship.entity.js';
import { ownedWeek } from '../tasks/queries.js';
import { User } from '../users/user.entity.js';
import { Note, Section } from './note.entity.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CreateNoteDto {
  @IsUUID()
  sectionId: string;

  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title: string;
}

// ValidateIf (not IsOptional) so an explicit null fails too: the columns are NOT NULL.
const given = (_: unknown, v: unknown) => v !== undefined;

class UpdateNoteDto {
  @ValidateIf(given)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  title?: string;

  @ValidateIf(given)
  @IsObject()
  content?: object;

  @ValidateIf(given)
  @IsInt()
  @Min(0)
  position?: number;
}

class SectionDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;
}

class OrderDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}

// The reflection tab's id in a tab order.
const REFLECTION = 'reflection';

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

function ownedSection(ds: DataSource, userId: string, id: string) {
  return ds
    .getRepository(Section)
    .createQueryBuilder('s')
    .innerJoin(Internship, 'i', 'i.id = s.internshipId')
    .where('s.id = :id AND i.userId = :userId', { id, userId })
    .getOne();
}

// ponytail: max + 1 isn't atomic. Two simultaneous creates could share a position; it's one person's journal.
async function nextPosition(ds: DataSource, entity: typeof Note | typeof Section, where: Record<string, string>) {
  const qb = ds.getRepository(entity).createQueryBuilder('x').select('max(x.position)', 'max');
  for (const [k, v] of Object.entries(where)) qb.andWhere(`x.${k} = :${k}`, { [k]: v });
  const row = await qb.getRawOne<{ max: number | null }>();
  return row?.max == null ? 0 : row.max + 1;
}

@Controller()
export class NotesController {
  constructor(private ds: DataSource) {}

  @Post('sections')
  async createSection(@CurrentUser() user: User, @Body() dto: SectionDto) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    if (!internship) throw new NotFoundException();
    // Always the last tab, after reflection too.
    const position = Math.max(await nextPosition(this.ds, Section, { internshipId: internship.id }), internship.reflectionPosition + 1);
    const s = await this.ds.getRepository(Section).save({ internshipId: internship.id, name: dto.name, position });
    return { id: s.id, name: s.name, position: s.position };
  }

  // Every tab in its new order: the user's section ids plus 'reflection', each exactly once.
  @Put('tabs/order')
  async reorderTabs(@CurrentUser() user: User, @Body() dto: OrderDto) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    if (!internship) throw new NotFoundException();
    const rows = await this.ds.getRepository(Section).findBy({ internshipId: internship.id });
    const mine = new Set([...rows.map((s) => s.id), REFLECTION]);
    if (dto.ids.length !== mine.size || new Set(dto.ids).size !== mine.size || !dto.ids.every((id) => mine.has(id))) {
      throw new BadRequestException('Send every tab id, and reflection, exactly once');
    }
    await this.ds.transaction(async (m) => {
      for (const [position, id] of dto.ids.entries()) {
        if (id === REFLECTION) await m.update(Internship, internship.id, { reflectionPosition: position });
        else await m.update(Section, id, { position });
      }
    });
    return { ids: dto.ids };
  }

  @Patch('sections/:id')
  async renameSection(@CurrentUser() user: User, @Param('id', uuid) id: string, @Body() dto: SectionDto) {
    const s = await ownedSection(this.ds, user.id, id);
    if (!s) throw new NotFoundException();
    await this.ds.getRepository(Section).update(s.id, { name: dto.name });
    return { id: s.id, name: dto.name, position: s.position };
  }

  // A tab with notes in any week needs ?force=true, because deleting it deletes those notes too.
  @Delete('sections/:id')
  @HttpCode(204)
  async removeSection(@CurrentUser() user: User, @Param('id', uuid) id: string, @Query('force') force?: string) {
    const s = await ownedSection(this.ds, user.id, id);
    if (!s) throw new NotFoundException();
    const count = await this.ds.getRepository(Note).countBy({ sectionId: s.id });
    if (count && force !== 'true') throw new ConflictException(`This tab has ${count} ${count === 1 ? 'note' : 'notes'} across your weeks.`);
    await this.ds.getRepository(Section).delete(s.id);
  }

  @Post('weeks/:id/notes')
  async create(@CurrentUser() user: User, @Param('id', uuid) id: string, @Body() dto: CreateNoteDto) {
    const week = await ownedWeek(this.ds, user.id, id);
    if (!week) throw new NotFoundException();
    const section = await ownedSection(this.ds, user.id, dto.sectionId);
    if (!section || section.internshipId !== week.internshipId) throw new NotFoundException();
    return this.ds.getRepository(Note).save({
      weekId: id,
      sectionId: section.id,
      title: dto.title || 'untitled',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      position: await nextPosition(this.ds, Note, { weekId: id, sectionId: section.id }),
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
