import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user-entity";
import { ProfileType } from "../../users/profile-type.enum";

@Entity("User_Profiles")
export class UserProfile {
  @PrimaryGeneratedColumn({ name: "profile_id", type: "int" })
  profileId!: number;

  @Column({ name: "user_id", type: "char", length: 9 })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "NO ACTION" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ name: "profile_type", type: "varchar", length: 12 })
  profileType!: ProfileType;

  @Column({ name: "name", type: "nvarchar", length: 50 })
  name!: string;

  @Column({ name: "first_last_name", type: "nvarchar", length: 50 })
  firstLastName!: string;

  @Column({ name: "second_last_name", type: "nvarchar", length: 50 })
  secondLastName!: string | null;

  @Column({
    name: "profile_picture",
    type: "nvarchar",
    length: 255,
    default: "default-profile-picture.png",
  })
  profilePicture!: string;

  @Column({ name: "email", type: "nvarchar", length: 255 })
  email!: string;

  @Column({ name: "phone", type: "char", length: 8 })
  phone!: string;
}
