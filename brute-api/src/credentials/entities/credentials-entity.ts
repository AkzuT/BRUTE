import { Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn, Column, OneToMany } from "typeorm";

import { UserProfile } from "../../users/entities/user-profile-entity";

import { CredentialStatus } from "../../credentials/credential-status.enum";

import { Token } from "src/tokens/entities/token-entity";

@Entity("Credentials")
export class Credential {
  @PrimaryGeneratedColumn({
    name: "cred_id",
    type: "int"
  })
  credId: number = 0;

  @OneToOne(() => UserProfile, (profile) => profile.credential, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "profile_id" })
  profile!: UserProfile;

  @Column({ 
    name: "identifier", 
    type: "nvarchar",
    length: 255,
    unique: true
  })
  identifier: string = "";

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true
  })
  passwordHash: string | null = null;

  @Column({ 
    name: "mfa_enrolled", 
    type: "bit", 
    default: false
  })
  mfaEnrolled: boolean = false;

  @Column({
    name: "encrypted_mfa_secret",
    type: "varbinary",
    length: "MAX",
    nullable: true
  })
  encryptedMfaSecret: Buffer | null = null;

  @Column({ 
    name: "mfa_secret_issued_at", 
    type: "datetime2", 
    nullable: true
  })
  mfaSecretIssuedAt: Date | null = null;

  @Column({
    name: "failed_attempts", 
    type: "int", 
    default: 0,
  })
  failedAttempts: number = 0;

  @Column({
    name: "locked_until", 
    type: "datetime2", 
    nullable: true
  })
  lockedUntil: Date | null = null;

  @Column({
    name: "status",
    type: "varchar",
    length: 12,
    default: CredentialStatus.PENDING
  })
  status: CredentialStatus = CredentialStatus.PENDING;

  // ---

  @OneToMany(() => Token, (tokens) => tokens.credential)
  tokens!: Token[];
}
