import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export function ownerEmail(): string {
  const email = process.env.ALLOWED_EMAILS?.split(',')[0]?.trim().toLowerCase();
  if (!email) throw new Error('ALLOWED_EMAILS is empty');
  return email;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
