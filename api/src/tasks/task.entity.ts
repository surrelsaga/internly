import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
