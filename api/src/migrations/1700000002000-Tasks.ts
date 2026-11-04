import { MigrationInterface, QueryRunner } from 'typeorm';

export class Tasks1700000002000 implements MigrationInterface {
  name = 'Tasks1700000002000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "tasks" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "internshipId" uuid NOT NULL,
      "title" character varying NOT NULL,
      "createdWeekId" uuid NOT NULL,
      "doneWeekId" uuid,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_tasks_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_tasks_internshipId" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_tasks_createdWeekId" FOREIGN KEY ("createdWeekId") REFERENCES "weeks"("id") ON DELETE CASCADE,
      CONSTRAINT "FK_tasks_doneWeekId" FOREIGN KEY ("doneWeekId") REFERENCES "weeks"("id") ON DELETE SET NULL
    )`);
    await q.query(`CREATE INDEX "IDX_tasks_internshipId" ON "tasks" ("internshipId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "tasks"`);
  }
}
