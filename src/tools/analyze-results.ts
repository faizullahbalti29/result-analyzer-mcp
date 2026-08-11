import { z } from "zod";
import type { Filter } from "mongodb";
import { getDatabase } from "../db.js";
import { getGBFilter } from "./result-filters.js";
import type { Student } from "../types/student.js";
// import type { Filter } from "mongodb";
export const analyzeResultsSchema = {
    collection: z.enum([
        "nineth_students",
        "tenth_students",
    ]),

    region: z.enum(["GB"]).optional(),

    filters: z
        .object({
            institution: z
                .object({
                    contains: z.string().optional(),
                    equals: z.string().optional(),
                    startsWith: z.string().optional(),
                })
                .optional(),

            name: z
                .object({
                    contains: z.string().optional(),
                    equals: z.string().optional(),
                    startsWith: z.string().optional(),
                })
                .optional(),

            roll_no: z
                .object({
                    equals: z.string().optional(),
                })
                .optional(),

            status: z
                .object({
                    equals: z.string().optional(),
                })
                .optional(),

            grade: z
                .object({
                    equals: z.string().optional(),
                })
                .optional(),

            marks: z
                .object({
                    equals: z.number().optional(),
                    greaterThan: z.number().optional(),
                    lessThan: z.number().optional(),
                    greaterThanOrEqual: z.number().optional(),
                    lessThanOrEqual: z.number().optional(),
                })
                .optional(),
        })
        .optional(),

    analysis: z.enum([
        "overview",
        "count",
        "status_summary",
        "grade_summary",
        "marks_summary",
        "institution_summary",
        "institution_status_summary",
        "institution_grade_summary",
        "top_students",
        "bottom_students",
    ]),

    limit: z.number().int().positive().max(100).default(10),
};
const AnalyzeResultsSchema = z.object(analyzeResultsSchema);

type AnalyzeResultsInput = z.infer<typeof AnalyzeResultsSchema>;

export async function analyzeResults(
    input: AnalyzeResultsInput
) {
    const db = await getDatabase();

    const collection = db.collection(input.collection);

    const filter = buildFilter(input);

    switch (input.analysis) {
        case "count":
            return analyzeCount(collection, filter);

        case "overview":
            return analyzeOverview(collection, filter);

        case "status_summary":
            return analyzeStatusSummary(collection, filter);

        case "grade_summary":
            return analyzeGradeSummary(collection, filter);

        case "marks_summary":
            return analyzeMarksSummary(collection, filter);

        case "institution_summary":
            return analyzeInstitutionSummary(
                collection,
                filter,
                input.limit ?? 10
            );

        case "institution_status_summary":
            return analyzeInstitutionStatusSummary(
                collection,
                filter,
                input.limit ?? 100
            );

        case "institution_grade_summary":
            return analyzeInstitutionGradeSummary(
                collection,
                filter,
                input.limit ?? 100
            );

        case "top_students":
            return getRankedStudents(
                collection,
                filter,
                input.limit ?? 10,
                -1
            );

        case "bottom_students":
            return getRankedStudents(
                collection,
                filter,
                input.limit ?? 10,
                1
            );
    }
}

function buildFilter(input: AnalyzeResultsInput): Filter<Student> {
    const conditions: Filter<Student>[] = [];

    if (input.region === "GB") {
        conditions.push(getGBFilter());
    }

    const filters = input.filters;

    if (filters?.institution) {
        const condition = filters.institution;

        if (condition.contains) {
            conditions.push({
                institution: {
                    $regex: escapeRegex(condition.contains),
                    $options: "i",
                },
            });
        } else if (condition.equals) {
            conditions.push({
                institution: condition.equals,
            });
        } else if (condition.startsWith) {
            conditions.push({
                institution: {
                    $regex: `^${escapeRegex(condition.startsWith)}`,
                    $options: "i",
                },
            });
        }
    }

    if (filters?.name) {
        const condition = filters.name;

        if (condition.contains) {
            conditions.push({
                name: {
                    $regex: escapeRegex(condition.contains),
                    $options: "i",
                },
            });
        } else if (condition.equals) {
            conditions.push({
                name: condition.equals,
            });
        } else if (condition.startsWith) {
            conditions.push({
                name: {
                    $regex: `^${escapeRegex(condition.startsWith)}`,
                    $options: "i",
                },
            });
        }
    }

    if (filters?.roll_no?.equals) {
        conditions.push({
            roll_no: filters.roll_no.equals,
        });
    }

    if (filters?.status?.equals) {
        conditions.push({
            status: filters.status.equals,
        });
    }

    if (filters?.grade?.equals) {
        conditions.push({
            grade: filters.grade.equals,
        });
    }

    if (filters?.marks) {
        const condition = filters.marks;

        const marks: Record<string, number> = {};

        if (condition.equals !== undefined) {
            marks.$eq = condition.equals;
        }

        if (condition.greaterThan !== undefined) {
            marks.$gt = condition.greaterThan;
        }

        if (condition.lessThan !== undefined) {
            marks.$lt = condition.lessThan;
        }

        if (condition.greaterThanOrEqual !== undefined) {
            marks.$gte = condition.greaterThanOrEqual;
        }

        if (condition.lessThanOrEqual !== undefined) {
            marks.$lte = condition.lessThanOrEqual;
        }

        if (Object.keys(marks).length) {
            conditions.push({
                marks,
            });
        }
    }

    if (conditions.length === 0) {
        return {};
    }

    if (conditions.length === 1) {
        return conditions[0]!;
    }

    return {
        $and: conditions,
    };
}

async function analyzeCount(
    collection: any,
    filter: Filter<Student>
) {
    const count = await collection.countDocuments(filter);

    return {
        count,
    };
}

async function analyzeOverview(
    collection: any,
    filter: Filter<Student>
) {
    const result = await collection.aggregate([
        {
            $match: filter,
        },
        {
            $group: {
                _id: null,
                totalStudents: { $sum: 1 },
                averageMarks: { $avg: "$marks" },
                highestMarks: { $max: "$marks" },
                lowestMarks: { $min: "$marks" },
            },
        },
        {
            $project: {
                _id: 0,
                totalStudents: 1,
                averageMarks: {
                    $round: ["$averageMarks", 2],
                },
                highestMarks: 1,
                lowestMarks: 1,
            },
        },
    ]).toArray();

    return result[0] ?? {
        totalStudents: 0,
        averageMarks: 0,
        highestMarks: null,
        lowestMarks: null,
    };
}

async function analyzeStatusSummary(
    collection: any,
    filter: Filter<Student>
) {
    return collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: {
                    count: -1,
                },
            },
            {
                $project: {
                    _id: 0,
                    status: "$_id",
                    count: 1,
                },
            },
        ])
        .toArray();
}

async function analyzeGradeSummary(
    collection: any,
    filter: Filter<Student>
) {
    return collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: "$grade",
                    count: { $sum: 1 },
                },
            },
            {
                $sort: {
                    count: -1,
                },
            },
            {
                $project: {
                    _id: 0,
                    grade: "$_id",
                    count: 1,
                },
            },
        ])
        .toArray();
}

async function analyzeMarksSummary(
    collection: any,
    filter: Filter<Student>
) {
    const result = await collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: null,
                    average: { $avg: "$marks" },
                    highest: { $max: "$marks" },
                    lowest: { $min: "$marks" },
                    total: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    total: 1,
                    average: { $round: ["$average", 2] },
                    highest: 1,
                    lowest: 1,
                },
            },
        ])
        .toArray();

    return result[0] ?? null;
}

async function analyzeInstitutionSummary(
    collection: any,
    filter: Filter<Student>,
    limit: number
) {
    return collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: "$institution",
                    totalStudents: { $sum: 1 },
                    averageMarks: { $avg: "$marks" },
                    highestMarks: { $max: "$marks" },
                },
            },
            {
                $sort: {
                    totalStudents: -1,
                },
            },
            {
                $limit: limit,
            },
            {
                $project: {
                    _id: 0,
                    institution: "$_id",
                    totalStudents: 1,
                    averageMarks: {
                        $round: ["$averageMarks", 2],
                    },
                    highestMarks: 1,
                },
            },
        ])
        .toArray();
}

async function analyzeInstitutionStatusSummary(
    collection: any,
    filter: Filter<Student>,
    limit: number
) {
    return collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: {
                        institution: "$institution",
                        status: "$status",
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $group: {
                    _id: "$_id.institution",
                    statuses: {
                        $push: {
                            status: "$_id.status",
                            count: "$count",
                        },
                    },
                    totalStudents: {
                        $sum: "$count",
                    },
                },
            },
            {
                $sort: {
                    totalStudents: -1,
                },
            },
            {
                $limit: limit,
            },
            {
                $project: {
                    _id: 0,
                    institution: "$_id",
                    totalStudents: 1,
                    statuses: 1,
                },
            },
        ])
        .toArray();
}

async function analyzeInstitutionGradeSummary(
    collection: any,
    filter: Filter<Student>,
    limit: number
) {
    return collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: {
                        institution: "$institution",
                        grade: "$grade",
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $group: {
                    _id: "$_id.institution",
                    grades: {
                        $push: {
                            grade: "$_id.grade",
                            count: "$count",
                        },
                    },
                },
            },
            {
                $sort: {
                    "_id": 1,
                },
            },
            {
                $limit: limit,
            },
            {
                $project: {
                    _id: 0,
                    institution: "$_id",
                    grades: 1,
                },
            },
        ])
        .toArray();
}

async function getRankedStudents(
    collection: any,
    filter: Filter<Student>,
    limit: number,
    direction: 1 | -1
) {
    return collection
        .find(filter)
        .sort({
            marks: direction,
        })
        .limit(limit)
        .project({
            _id: 0,
        })
        .toArray();
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}