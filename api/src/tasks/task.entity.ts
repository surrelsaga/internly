import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  internshipId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'uuid' })
  createdWeekId: string;

  // Null while not done. The week the task was ticked in.
  @Column({ type: 'uuid', nullable: true })
  doneWeekId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Set when deleted, so undo can restore it. TypeORM's finds and query builders skip these rows on their own.
  // ponytail: deleted rows are never purged; one person's task list stays tiny. Add a cleanup job if that changes.
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}
