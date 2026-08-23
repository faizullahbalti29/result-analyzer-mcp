import { ObjectId } from "mongodb";

export interface Student {
  _id: ObjectId;
  roll_no: string;
  name: string;
  status: string | null;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
  institution: string;
}