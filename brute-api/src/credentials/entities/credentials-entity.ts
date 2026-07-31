import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { UserProfile } from "../../users/entities/user-profile-entity";
import { CredentialStatus } from "../../credentials/credential-status.enum";
import { User } from "src/users/entities/user-entity";

@Entity("Credentials")
export class Credential {
  @PrimaryGeneratedColumn({ name: "cred_id", type: "int" })
  credId!: number;

  @Column({ name: "profile_id", type: "int" })
  profileId!: number;

  @ManyToOne(() => UserProfile, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "profile_id" })
  profile!: UserProfile;

  @Column({ name: "identifier", type: "nvarchar", length: 255 })
  identifier!: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  passwordHash!: string | null;

  @Column({ name: "mfa_enrolled", type: "bit", default: false })
  mfaEnrolled: boolean = false;

  @Column({
    name: "encrypted_mfa_secret",
    type: "varbinary",
    length: "MAX",
    nullable: true,
  })
  encryptedMfaSecret!: Buffer | null;

  @Column({ name: "mfa_secret_issued_at", type: "datetime2", nullable: true })
  mfaSecretIssuedAt!: Date | null;

  @Column({ name: "failed_attempts", type: "int", default: 0 })
  failedAttempts: number = 0;

  @Column({ name: "locked_until", type: "datetime2", nullable: true })
  lockedUntil!: Date | null;

  @Column({
    name: "status",
    type: "varchar",
    length: 12,
    default: CredentialStatus.PENDING,
  })
  status: CredentialStatus = CredentialStatus.PENDING;
}
