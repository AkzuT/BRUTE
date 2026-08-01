import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column, OneToOne } from "typeorm";

import { ProfileType } from "../../users/profile-type.enum";

import { User } from "./user-entity";
import { Credential } from "src/credentials/entities/credentials-entity";

@Entity("User_Profiles")
export class UserProfile {
  @PrimaryGeneratedColumn({
    name: "profile_id",
    type: "int"
  })
  profileId: number = 0;

  @ManyToOne(() => User, (user) => user.profiles, { onDelete: "NO ACTION"})
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({
    name: "profile_type",
    type: "varchar",
    length: 12
  })
  profileType!: ProfileType;

  @Column({
    name: "name",
    type: "nvarchar",
    length: 50
  })
  name: string = "";

  @Column({
    name: "first_last_name",
    type: "nvarchar",
    length: 50
  })
  firstLastName: string = "";

  @Column({
    name: "second_last_name",
    type: "nvarchar",
    length: 50,
    nullable: true
  })
  secondLastName: string | null = null;

  @Column({
    name: "profile_picture",
    type: "nvarchar",
    length: 255,
    default: "default-profile-picture.png"
  })
  profilePicture: string = "";

  @Column({
    name: "email",
    type: "nvarchar",
    length: 255
  })
  email: string = "";

  @Column({
    name: "phone",
    type: "char",
    length: 8
  })
  phone: string  = "";

  // ---

  @OneToOne(() => Credential, (credential) => credential.profile)
  credential!: Credential;
}
