import { Entity, PrimaryColumn, CreateDateColumn, OneToMany } from "typeorm";

import { UserProfile } from "./user-profile-entity";
import { UserPhone } from "./user-phone-entity";

@Entity("Users")
export class User {
  @PrimaryColumn({
    name: "user_id",
    type: "char",
    length: 9
  })
  userId: string = "";

  @CreateDateColumn({
    name: "created_at",
    type: "datetime2"
  })
  createdAt: Date = new Date;

  // ---

  @OneToMany(() => UserPhone, (phone) => phone.user)
  phones!: UserPhone[];
  
  @OneToMany(() => UserProfile, (profile) => profile.user)
  profiles!: UserProfile[];
}
