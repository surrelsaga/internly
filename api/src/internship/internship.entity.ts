import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('internships')
export class Internship {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'varchar' })
  company: string;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  // Weeks before this are backfill.
  @Column({ type: 'date' })
  trackingStartDate: string;

  // Step 8 uses this.
  @Column({ type: 'uuid', nullable: true })
  lastEmailedWeekId: string | null;

  // Where the reflection tab sits among the note tabs (same scale as Section.position).
  @Column({ type: 'int', default: 0 })
  reflectionPosition: number;
}

@Entity('weeks')
export class Week {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  internshipId: string;

  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;
}
