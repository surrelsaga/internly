import { tasksForWeek, type TaskRow } from './tasks.js';

const task = (createdWeek: number, doneWeek: number | null): TaskRow => ({ id: 'a', title: 't', createdWeek, doneWeek });
const shownIn = (t: TaskRow, weeks: number[]) => weeks.filter((w) => tasksForWeek([t], w).length > 0);

describe('tasksForWeek', () => {
  it('created in week 2 and never ticked: shows from week 2 on, not in week 1', () => {
    const t = task(2, null);
    expect(shownIn(t, [1, 2, 3, 4, 5, 6])).toEqual([2, 3, 4, 5, 6]);
    expect(tasksForWeek([t], 2)[0]).toMatchObject({ done: false, fromWeek: null });
    expect(tasksForWeek([t], 4)[0]).toMatchObject({ done: false, fromWeek: 2 });
  });

  it('created in week 2 and ticked in week 4: shows in 2 to 4, ticked only in 4, gone in 5', () => {
    const t = task(2, 4);
    expect(shownIn(t, [1, 2, 3, 4, 5, 6])).toEqual([2, 3, 4]);
    expect([2, 3, 4].map((w) => tasksForWeek([t], w)[0].done)).toEqual([false, false, true]);
    expect(tasksForWeek([t], 4)[0].fromWeek).toBe(2);
  });

  it('unticking puts it back in later weeks', () => {
    expect(shownIn(task(2, 4), [5])).toEqual([]);
    expect(shownIn(task(2, null), [5])).toEqual([5]);
  });

  it('ticked in its own week', () => {
    expect(tasksForWeek([task(3, 3)], 3)[0]).toMatchObject({ done: true, fromWeek: null });
  });
});
