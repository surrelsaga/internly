import { DataSource } from 'typeorm';
import { Internship, Week } from '../internship/internship.entity.js';
import { Task } from './task.entity.js';
import { tasksForWeek } from './tasks.js';

// The week if it belongs to this user's internship, otherwise null.
export function ownedWeek(ds: DataSource, userId: string, id: string) {
  return ds
    .getRepository(Week)
    .createQueryBuilder('w')
    .innerJoin(Internship, 'i', 'i.id = w.internshipId')
    .where('w.id = :id AND i.userId = :userId', { id, userId })
    .getOne();
}

export function ownedTask(ds: DataSource, userId: string, id: string) {
  return ds
    .getRepository(Task)
    .createQueryBuilder('t')
    .innerJoin(Internship, 'i', 'i.id = t.internshipId')
    .where('t.id = :id AND i.userId = :userId', { id, userId })
    .getOne();
}

// ponytail: loads all of the internship's tasks and filters in JS. It's one person's list.
export async function weekTasks(ds: DataSource, week: Week) {
  const weeks = await ds.getRepository(Week).findBy({ internshipId: week.internshipId });
  const numberOf = new Map(weeks.map((w) => [w.id, w.number]));
  const tasks = await ds.getRepository(Task).find({ where: { internshipId: week.internshipId }, order: { createdAt: 'ASC' } });
  return tasksForWeek(
    tasks.map((t) => ({
      id: t.id,
      title: t.title,
      createdWeek: numberOf.get(t.createdWeekId)!,
      doneWeek: t.doneWeekId ? numberOf.get(t.doneWeekId)! : null,
    })),
    week.number,
  );
}
