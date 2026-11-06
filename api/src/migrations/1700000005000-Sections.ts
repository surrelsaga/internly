import { MigrationInterface, QueryRunner } from 'typeorm';

// Note tabs become user-defined sections, shared by every week of an internship.
// Internships that exist now keep "dev notes" and "research notes"; new ones start with none.
export class Sections1700000005000 implements MigrationInterface {
  name = 'Sections1700000005000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "sections" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "internshipId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "position" integer NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_sections_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_sections_internshipId" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE INDEX "IDX_sections_internshipId" ON "sections" ("internshipId")`);
    await q.query(`INSERT INTO "sections" ("internshipId", "name", "position")
      SELECT "id", 'dev notes', 0 FROM "internships"
      UNION ALL SELECT "id", 'research notes', 1 FROM "internships"`);

    await q.query(`ALTER TABLE "notes" ADD "sectionId" uuid`);
    await q.query(`UPDATE "notes" n SET "sectionId" = s."id"
      FROM "weeks" w, "sections" s
      WHERE w."id" = n."weekId" AND s."internshipId" = w."internshipId"
        AND s."name" = CASE n."type" WHEN 'dev' THEN 'dev notes' ELSE 'research notes' END`);
    await q.query(`ALTER TABLE "notes" ALTER COLUMN "sectionId" SET NOT NULL`);
    await q.query(`ALTER TABLE "notes" ADD CONSTRAINT "FK_notes_sectionId" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE`);
    await q.query(`CREATE INDEX "IDX_notes_sectionId" ON "notes" ("sectionId")`);
    await q.query(`ALTER TABLE "notes" DROP CONSTRAINT "CHK_notes_type"`);
    await q.query(`ALTER TABLE "notes" DROP COLUMN "type"`);
  }

  // ponytail: lossy. Notes go back to 'research' only if their tab is still named "research notes"; everything else becomes 'dev'.
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "notes" ADD "type" character varying NOT NULL DEFAULT 'dev'`);
    await q.query(`UPDATE "notes" n SET "type" = 'research' FROM "sections" s WHERE s."id" = n."sectionId" AND s."name" = 'research notes'`);
    await q.query(`ALTER TABLE "notes" ALTER COLUMN "type" DROP DEFAULT`);
    await q.query(`ALTER TABLE "notes" ADD CONSTRAINT "CHK_notes_type" CHECK ("type" IN ('dev', 'research'))`);
    await q.query(`ALTER TABLE "notes" DROP COLUMN "sectionId"`);
    await q.query(`DROP TABLE "sections"`);
  }
}
