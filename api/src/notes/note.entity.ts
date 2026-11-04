import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NoteType = 'dev' | 'research';

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  weekId: string;

  @Column({ type: 'varchar' })
  type: NoteType;

  @Column({ type: 'varchar', default: 'untitled' })
  title: string;

  // TipTap JSON document.
  @Column({ type: 'jsonb' })
  content: object;

  @Column({ type: 'int' })
  position: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
