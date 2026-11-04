import { MigrationInterface, QueryRunner } from 'typeorm';

export class Internship1700000001000 implements MigrationInterface {
  name = 'Internship1700000001000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "internships" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "company" character varying NOT NULL,
      "startDate" date NOT NULL,
      "endDate" date NOT NULL,
      "trackingStartDate" date NOT NULL,
      "lastEmailedWeekId" uuid,
      CONSTRAINT "PK_internships_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_internships_userId" UNIQUE ("userId"),
      CONSTRAINT "FK_internships_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await q.query(`CREATE TABLE "weeks" (
      "id" uuid NOT NULL DEFAULT gen_random_uuid(),
      "internshipId" uuid NOT NULL,
      "number" integer NOT NULL,
      "startDate" date NOT NULL,
      "endDate" date NOT NULL,
      CONSTRAINT "PK_weeks_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_weeks_internship_number" UNIQUE ("internshipId", "number"),
      CONSTRAINT "FK_weeks_internshipId" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE CASCADE
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "weeks"`);
    await q.query(`DROP TABLE "internships"`);
  }
}
