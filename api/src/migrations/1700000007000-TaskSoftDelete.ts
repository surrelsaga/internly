import { MigrationInterface, QueryRunner } from 'typeorm';

// Deleting a task only marks it, so the task panel's undo can bring it back as it was (same weeks, same order).
export class TaskSoftDelete1700000007000 implements MigrationInterface {
  name = 'TaskSoftDelete1700000007000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "tasks" ADD "deletedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "tasks" WHERE "deletedAt" IS NOT NULL`);
    await q.query(`ALTER TABLE "tasks" DROP COLUMN "deletedAt"`);
  }
}
