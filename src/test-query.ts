import { getDatabase } from "./db/mongodb.js";

async function main() {
  const db = await getDatabase();

  const students = db.collection("tenth_students");

  // Test 1: find
  const topStudents = await students
    .find({ status: "PASS" })
    .sort({ marks: -1 })
    .limit(5)
    .toArray();

  console.log("\n=== TOP 5 STUDENTS ===");
  console.dir(topStudents, { depth: null });

  // Test 2: findOne
  const student = await students.findOne({
    roll_no: "1000002",
  });

  console.log("\n=== FIND ONE ===");
  console.dir(student, { depth: null });

  // Test 3: countDocuments
  const passCount = await students.countDocuments({
    status: "PASS",
  });

  console.log("\n=== PASS COUNT ===");
  console.log(passCount);

  // Test 4: distinct
  const statuses = await students.distinct("status");

  console.log("\n=== STATUSES ===");
  console.log(statuses);

  // Test 5: aggregate
  const institutionStats = await students
    .aggregate([
      {
        $match: {
          status: "PASS",
        },
      },
      {
        $group: {
          _id: "$institution",
          students: {
            $sum: 1,
          },
          averageMarks: {
            $avg: "$marks",
          },
        },
      },
      {
        $sort: {
          averageMarks: -1,
        },
      },
      {
        $limit: 5,
      },
    ])
    .toArray();

  console.log("\n=== INSTITUTION STATISTICS ===");
  console.dir(institutionStats, { depth: null });
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});