import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, CreateDateColumn } from "typeorm";
import { Credential } from "../../credentials/entities/credentials-entity";
import { TokenType } from "../token-type.enum";

@Entity("Tokens")
export class Token {
  @PrimaryGeneratedColumn({
    name: "token_id",
    type: "int"
  })
  tokenId!: number;

  @ManyToOne(() => Credential, (credential) => credential.tokens, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "cred_id" })
  credential!: Credential;

  @Column({
    name: "token_type",
    type: "varchar",
    length: 15,

    nullable: false
  })
  tokenType!: TokenType;

  @Column({
    name: "token_hash",
    type: "varchar",
    length: 255,
    unique: true,

    nullable: false
  })
  tokenHash!: string;

  @CreateDateColumn({
    name: "created_at",
    type: "datetime2"
  })
  createdAt!: Date;

  @Column({
    name: "expires_at",
    type: "datetime2",

    nullable: false
  })
  expiresAt!: Date;

  @Column({
    name: "revoked",
    type: "bit",
    default: false,

    nullable: false,
  })
  revoked!: boolean;

  @Column({
    name: "user_agent",
    type: "nvarchar",
    length: 255,

    nullable: false
  })
  userAgent!: string;
}
