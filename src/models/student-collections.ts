export const STUDENT_COLLECTIONS = {
  nineth_students: {
    class: "9th",
    maxMarks: 550,
    gradeAvailable: false,
  },

  tenth_students: {
    class: "10th",
    maxMarks: 1100,
    gradeAvailable: true,
  },
} as const;

export type StudentCollection = keyof typeof STUDENT_COLLECTIONS;