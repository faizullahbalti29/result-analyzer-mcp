import { z } from "zod";
import { getDatabase } from "../db.js";
import { getGBFilter } from "./result-filters.js";

import {
    ALLOWED_SUBJECTS,
    ALLOWED_REMARKS,
    ALLOWED_GRADES,
    ALLOWED_STATUS,
    INSTITUTION_KEYWORDS,
} from "../constants/result-validation.js";

import type { Filter } from "mongodb";
import type { Student } from "../types/student.js";
import { escapeRegex } from "../utils/escape-regex.js";


export const validateResultsSchema = {
    collection: z.enum([
        "nineth_students",
        "tenth_students",
    ]),

    region: z.enum(["GB"]).optional(),

    check: z.enum([
        "all",
        "status",
        "grade",
        "remarks",
        "institution",
    ]),
};

type ValidateResultsInput = {
    collection:
    | "nineth_students"
    | "tenth_students";

    region?: "GB" | undefined;

    check:
    | "all"
    | "status"
    | "grade"
    | "remarks"
    | "institution";
};

export async function validateResults(
    input: ValidateResultsInput
) {
    const db = await getDatabase();

    const collection = db.collection<Student>(
        input.collection
    );

    const filter = buildValidationFilter(input);

    const checks: Record<string, unknown> = {};

    if (
        input.check === "all" ||
        input.check === "status"
    ) {
        checks.status = await findInvalidStatus(
            collection,
            filter
        );
    }

    if (
        input.check === "all" ||
        input.check === "grade"
    ) {
        checks.grade = await findInvalidGrade(
            collection,
            filter
        );
    }

    if (
        input.check === "all" ||
        input.check === "remarks"
    ) {
        checks.remarks = await findInvalidRemarks(
            collection,
            filter
        );
    }

    if (
        input.check === "all" ||
        input.check === "institution"
    ) {
        checks.institution =
            await findInvalidInstitutions(
                collection,
                filter
            );
    }

    const invalidCount = Object.values(checks).reduce(
        (total: number, result: any) => {
            if (
                result &&
                typeof result === "object" &&
                "invalidCount" in result &&
                typeof result.invalidCount === "number"
            ) {
                return total + result.invalidCount;
            }

            return total;
        },
        0
    );

    return {
        collection: input.collection,
        region: input.region ?? null,
        valid: invalidCount === 0,
        invalidCount,
        checks,
    };
}

function buildValidationFilter(
    input: ValidateResultsInput
): Filter<Student> {
    if (input.region === "GB") {
        return getGBFilter();
    }

    return {};
}

async function findInvalidStatus(
    collection: any,
    filter: Filter<Student>
) {
    const values = await collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: "$status",
                    count: {
                        $sum: 1,
                    },
                },
            },
            {
                $match: {
                    _id: {
                        $nin: Array.from(
                            ALLOWED_STATUS
                        ),
                    },
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
                    value: "$_id",
                    count: 1,
                },
            },
        ])
        .toArray();

    return {
        valid: values.length === 0,
        invalidCount: values.reduce(
            (sum: number, item: any) =>
                sum + item.count,
            0
        ),
        invalidValues: values,
    };
}

async function findInvalidGrade(
    collection: any,
    filter: Filter<Student>
) {
    const values = await collection
        .aggregate([
            {
                $match: filter,
            },
            {
                $group: {
                    _id: "$grade",
                    count: {
                        $sum: 1,
                    },
                },
            },
            {
                $match: {
                    _id: {
                        $nin: Array.from(
                            ALLOWED_GRADES
                        ),
                    },
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
                    value: "$_id",
                    count: 1,
                },
            },
        ])
        .toArray();

    return {
        valid: values.length === 0,
        invalidCount: values.reduce(
            (sum: number, item: any) =>
                sum + item.count,
            0
        ),
        invalidValues: values,
    };
}

async function findInvalidRemarks(
    collection: any,
    filter: Filter<Student>
) {
    const allowedRemarks = Array.from(
        ALLOWED_REMARKS
    );

    const allowedSubjects = Array.from(
        ALLOWED_SUBJECTS
    );

    const allowedValues = [
        ...allowedRemarks,
        ...allowedSubjects,
    ];

    const values = await collection
        .aggregate([
            {
                $match: {
                    ...filter,
                    remarks: {
                        $nin: allowedValues,
                        $ne: null,
                    },
                },
            },
            {
                $group: {
                    _id: "$remarks",
                    count: {
                        $sum: 1,
                    },
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
                    value: "$_id",
                    count: 1,
                },
            },
        ])
        .toArray();

    return {
        valid: values.length === 0,
        invalidCount: values.reduce(
            (sum: number, item: any) =>
                sum + item.count,
            0
        ),
        invalidValues: values,
    };
}

async function findInvalidInstitutions(
    collection: any,
    filter: Filter<Student>
) {
    const institutionPattern =
        INSTITUTION_KEYWORDS
            .map((keyword) => escapeRegex(keyword))
            .join("|");

    const values = await collection
        .aggregate([
            {
                $match: {
                    ...filter,

                    institution: {
                        $nin: [null, ""],
                        $not: {
                            $regex: institutionPattern,
                            $options: "i",
                        },
                    },
                },
            },

            {
                $group: {
                    _id: "$institution",

                    count: {
                        $sum: 1,
                    },

                    sampleStudents: {
                        $push: {
                            roll_no: "$roll_no",
                            name: "$name",
                            status: "$status",
                            grade: "$grade",
                            marks: "$marks",
                            remarks: "$remarks",
                        },
                    },
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

                    institution: "$_id",

                    count: 1,

                    sampleStudents: {
                        $slice: [
                            "$sampleStudents",
                            5,
                        ],
                    },
                },
            },
        ])
        .toArray();

    const invalidCount = values.reduce(
        (sum: number, item: any) =>
            sum + item.count,
        0
    );

    return {
        valid: values.length === 0,

        invalidCount,

        invalidValues: values,
    };
}