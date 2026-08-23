export const STUDENT_SCHEMA = {
  description:
    "Student examination result record. The same schema and business rules are used for 9th, 10th, 11th, and 12th class student result collections.",

  fields: {
    _id: {
      type: "ObjectId",
      description: "MongoDB document identifier.",
    },

    roll_no: {
      type: "string",
      nullable: false,
      description:
        "Student examination roll number. This field is always present.",
    },

    name: {
      type: "string",
      nullable: false,
      description: "Student's name.",
    },

status: {
  type: "string | null",
  nullable: true,
  values: [
    "PASS",
    "COMPT.",
    "Absent",
    "FAIL"
  ],
  description:
    "Result status. The database may also contain null. 'Absent' is the observed spelling for absent students."
},

    marks: {
      type: "number | null",
      nullable: true,
      description:
        "Total marks obtained. Null when the student has a status such as COMPT. or ABSENT where marks are not recorded.",
    },

    grade: {
      type: "string | null",
      nullable: true,
      values: ["A1", "A", "B", "C", "D", "E", "F"],
      description:
        "Stored grade value. Never derive or calculate the grade from marks. 9th-class records have no grade and therefore normally contain null.",
    },

    remarks: {
      type: "string | null",
      nullable: true,
      description:
        "Additional result information. For COMPT. records it can contain failed subject codes. It can also contain other result information such as R-Later, RW, RW-Fee, and multiple remarks.",
    },

    institution: {
      type: "string",
      nullable: false,
      description:
        "Institution to which the student belongs. The stored format may contain only the institution name, the name with an institution code, or the code with the name.",
    },
  },
} as const;