import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from "typeorm";

import { User } from "./user-entity";

@Entity("User_Phones")
export class UserPhone {
  @PrimaryColumn({
    name: "phone",
    type: "char",
    length: 8
  })
  phone: string = "";

  @ManyToOne(() => User, (user) => user.phones, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "user_id" })
  user!: User;
}
