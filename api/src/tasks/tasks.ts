// Pure carry-over rule. Weeks are compared by number.

export type TaskRow = { id: string; title: string; createdWeek: number; doneWeek: number | null };

// A week shows a task if it was created in or before that week, and it is
// either not done or was done in or after that week. It's ticked only in the
// week it was done.
export function tasksForWeek(tasks: TaskRow[], weekNumber: number) {
  return tasks
    .filter((t) => t.createdWeek <= weekNumber && (t.doneWeek === null || t.doneWeek >= weekNumber))
    .map((t) => ({
      id: t.id,
      title: t.title,
      done: t.doneWeek === weekNumber,
      fromWeek: t.createdWeek !== weekNumber ? t.createdWeek : null,
    }));
}
