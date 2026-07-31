import { Entity, PrimaryColumn, CreateDateColumn } from "typeorm";

@Entity("Users")
export class User {
  @PrimaryColumn({ name: "user_id", type: "char", length: 9 })
  userId!: string;

  @CreateDateColumn({ name: "created_at", type: "datetime2" })
  createdAt!: Date;
}
