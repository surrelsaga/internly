import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A notes tab ("dev notes", "meetings", ...). It belongs to the internship, so every week shows it.
@Entity('sections')
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  internshipId: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'int' })
  position: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  weekId: string;

  @Column({ type: 'uuid' })
  sectionId: string;

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
