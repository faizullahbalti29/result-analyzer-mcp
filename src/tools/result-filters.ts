import type { Filter } from "mongodb";
import type { Student } from "../types/student.js";

/**
 * Gilgit-Baltistan institution matching rules.
 *
 * Institutions are considered GB institutions when their institution
 * name contains one of the approved GB-related keywords.
 *
 * Specific false-positive institution/location names are excluded.
 */

const GB_INCLUDE_REGEX =
    "\\b(gilgit|baltistan|skardu|chilas|khaplu|shigar|kharmang|ghanche|astore|ghizer|hunza|nagar|gupis|yasin|phander|ishkoman|danyor|jaglot|aliabad|karimabad|gojal|shinaki|chalt|darel|tangir|babusar|goharabad|punial|gulabpur|gultari|roundu|gamba|daghoni|mashabrum|chorbat|keris|haldi|shounter|jutial|gilg|danyore|office sharote|post office rahimabad|village choungrah|begum viqar-un-nisa noon)\\b";

const GB_EXCLUDE_REGEX =
    "\\b(irshad nagar|st\\.5 block-3, aliabad|village raazi dero taluka, gamba)\\b";

/**
 * Returns the MongoDB filter that identifies
 * Gilgit-Baltistan institutions.
 */
export function getGBFilter(): Filter<Student> {
    return {
        $and: [
            {
                institution: {
                    $regex: GB_INCLUDE_REGEX,
                    $options: "i",
                },
            },
            {
                institution: {
                    $not: {
                        $regex: GB_EXCLUDE_REGEX,
                        $options: "i",
                    },
                },
            },
        ],
    };
}