import { MigrationInterface, QueryRunner } from 'typeorm';

// The reflection tab gets a place among the note tabs (same position scale as sections.position).
// Existing internships keep it after their tabs; new ones start with it first (0), and new tabs go after it.
export class ReflectionPosition1700000006000 implements MigrationInterface {
  name = 'ReflectionPosition1700000006000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "internships" ADD "reflectionPosition" integer NOT NULL DEFAULT 0`);
    await q.query(`UPDATE "internships" i SET "reflectionPosition" = COALESCE((SELECT max(s."position") + 1 FROM "sections" s WHERE s."internshipId" = i."id"), 0)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "internships" DROP COLUMN "reflectionPosition"`);
  }
}
