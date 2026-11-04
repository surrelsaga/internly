import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('reflections')
export class Reflection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  weekId: string;

  @Column({ type: 'text', default: '' })
  learnt: string;

  @Column({ type: 'text', default: '' })
  wentWell: string;

  @Column({ type: 'text', default: '' })
  needHelp: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
