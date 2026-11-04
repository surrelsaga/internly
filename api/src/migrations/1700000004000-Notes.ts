import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notes1700000004000 implements MigrationInterface {
  name = 'Notes1700000004000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "notes" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "weekId" uuid NOT NULL,
      "type" character varying NOT NULL,
      "title" character varying NOT NULL DEFAULT 'untitled',
      "content" jsonb NOT NULL,
      "position" integer NOT NULL,
      "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_notes_id" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_notes_type" CHECK ("type" IN ('dev', 'research')),
      CONSTRAINT "FK_notes_weekId" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_notes_weekId" ON "notes" ("weekId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "notes"`);
  }
}
