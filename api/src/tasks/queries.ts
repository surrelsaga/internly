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

// withDeleted: also find a deleted task (only restore needs that).
export function ownedTask(ds: DataSource, userId: string, id: string, withDeleted = false) {
  const qb = ds.getRepository(Task).createQueryBuilder('t');
  if (withDeleted) qb.withDeleted();
  return qb
    .innerJoin(Internship, 'i', 'i.id = t.internshipId')
    .where('t.id = :id AND i.userId = :userId', { id, userId })
    .getOne();
}

// Task rows keyed by week number, for tasksForWeek.
export function taskRows(weeks: Pick<Week, 'id' | 'number'>[], tasks: Task[]) {
  const numberOf = new Map(weeks.map((w) => [w.id, w.number]));
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    createdWeek: numberOf.get(t.createdWeekId)!,
    doneWeek: t.doneWeekId ? numberOf.get(t.doneWeekId)! : null,
  }));
}

export const internshipTasks = (ds: DataSource, internshipId: string) => ds.getRepository(Task).find({ where: { internshipId }, order: { createdAt: 'ASC' } });

// ponytail: loads all of the internship's tasks and filters in JS. It's one person's list.
export async function weekTasks(ds: DataSource, week: Week) {
  const weeks = await ds.getRepository(Week).findBy({ internshipId: week.internshipId });
  return tasksForWeek(taskRows(weeks, await internshipTasks(ds, week.internshipId)), week.number);
}
