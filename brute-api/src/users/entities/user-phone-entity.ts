import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user-entity";

@Entity("User_Phones")
export class UserPhone {
  @PrimaryColumn({ name: "phone", type: "char", length: 8 })
  phone!: string;

  @Column({ name: "user_id", type: "char", length: 9 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
