import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { Credential } from "../../credentials/entities/credentials-entity";
import { TokenType } from "../token-type.enum";

@Entity("Tokens")
export class Token {
  @PrimaryGeneratedColumn({ name: "token_id", type: "int" })
  tokenId!: number;

  @Column({ name: "cred_id", type: "int" })
  credId!: number;

  @ManyToOne(() => Credential, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "cred_id" })
  credential!: Credential;

  @Column({ name: "token_type", type: "varchar", length: 15 })
  tokenType!: TokenType;

  @Column({ name: "token_hash", type: "varchar", length: 255, unique: true })
  tokenHash!: string;

  @CreateDateColumn({ name: "created_at", type: "datetime2" })
  createdAt!: Date;

  @Column({ name: "expires_at", type: "datetime2" })
  expiresAt!: Date;

  @Column({ name: "revoked", type: "bit", default: false })
  revoked!: boolean;

  @Column({ name: "user_agent", type: "nvarchar", length: 500, nullable: true })
  userAgent!: string | null;
}
