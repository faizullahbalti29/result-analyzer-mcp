export const STUDENT_SCHEMA = {
  description:
    "Student examination result record. The ninth_students collection contains 9th class results and the tenth_students collection contains 10th class results.",

  fields: {
    _id: {
      type: "ObjectId",
      description: "MongoDB document identifier",
    },

    roll_no: {
      type: "string",
      description: "Student examination roll number",
    },

    name: {
      type: "string",
      description: "Student name",
    },

    status: {
      type: "string | null",
      description:
        "Result status, such as PASS, COMPT., ABSENT, these statuses are not case sensitive",
    },

    marks: {
      type: "number | null",
      description:
        "Total marks obtained by the student. Null when marks are not available.",
    },

    grade: {
      type: "string | null",
      description: "Overall grade. Null when no grade is available.",
    },

    remarks: {
      type: "string | null",
      description:
        "Additional result remarks, such as failed or compartment subjects.",
    },

    institution: {
      type: "string",
      description:
        "Full institution name, including institution code when present.",
    },
  },
} as const;