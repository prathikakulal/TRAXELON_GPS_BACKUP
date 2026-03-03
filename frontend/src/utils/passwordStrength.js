import zxcvbn from "zxcvbn";

/**
 * Minimum acceptable zxcvbn score (0-4).
 * 3 = "Good" — required for Signup and Reset Password.
 */
export const MIN_SCORE = 3;

const SCORE_MAP = [
    { label: "Very Weak", color: "bg-red-500", text: "text-red-500" },
    { label: "Weak", color: "bg-orange-500", text: "text-orange-500" },
    { label: "Fair", color: "bg-yellow-500", text: "text-yellow-400" },
    { label: "Good", color: "bg-blue-400", text: "text-blue-400" },
    { label: "Strong", color: "bg-green-500", text: "text-green-500" },
];

/**
 * Analyse a password with zxcvbn.
 * @param {string} password
 * @returns {{ score: number, label: string, color: string, text: string, warning: string, suggestions: string[] }}
 */
export function analyzePassword(password) {
    if (!password) {
        return { score: 0, label: "Very Weak", color: "bg-red-500", text: "text-red-500", warning: "", suggestions: [] };
    }

    const result = zxcvbn(password);
    const { score, feedback } = result;
    const { label, color, text } = SCORE_MAP[score] ?? SCORE_MAP[0];

    return {
        score,
        label,
        color,
        text,
        warning: feedback.warning || "",
        suggestions: feedback.suggestions || [],
    };
}
