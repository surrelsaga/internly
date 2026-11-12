import { MigrationInterface, QueryRunner } from 'typeorm';

// A read-only share link for the whole internship. The token is made once and kept, so turning sharing
// off and on again brings back the same link (like a Google Doc's "anyone with the link").
export class Share1700000008000 implements MigrationInterface {
  name = 'Share1700000008000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "internships" ADD "shareToken" varchar UNIQUE`);
    await q.query(`ALTER TABLE "internships" ADD "shareEnabled" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "internships" DROP COLUMN "shareEnabled"`);
    await q.query(`ALTER TABLE "internships" DROP COLUMN "shareToken"`);
  }
}
