import { MigrationInterface, QueryRunner } from 'typeorm';

export class Reflections1700000003000 implements MigrationInterface {
  name = 'Reflections1700000003000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "reflections" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "weekId" uuid NOT NULL,
      "learnt" text NOT NULL DEFAULT '',
      "wentWell" text NOT NULL DEFAULT '',
      "needHelp" text NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_reflections_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_reflections_weekId" UNIQUE ("weekId"),
      CONSTRAINT "FK_reflections_weekId" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "reflections"`);
  }
}
