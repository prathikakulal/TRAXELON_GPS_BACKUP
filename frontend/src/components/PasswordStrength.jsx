import React from "react";
import { analyzePassword } from "../utils/passwordStrength";

/**
 * Reusable PasswordStrength component.
 * Renders a 5-segment meter, label, warnings, and suggestions.
 * Hidden when password is empty.
 *
 * @param {{ password: string }} props
 */
export default function PasswordStrength({ password }) {
    if (!password) return null;

    const { score, label, color, text, warning, suggestions } = analyzePassword(password);

    return (
        <div className="mt-2 space-y-2">
            {/* 5-segment bar */}
            <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= score ? color : "bg-surface-border"
                            }`}
                    />
                ))}
            </div>

            {/* Label */}
            <div className="flex items-center justify-between">
                <span className={`font-mono text-xs font-semibold tracking-wider ${text}`}>
                    {label}
                </span>
                <span className="font-body text-xs text-text-muted">
                    Score: {score}/4
                </span>
            </div>

            {/* Warning */}
            {warning && (
                <p className="font-body text-xs text-orange-400 flex items-start gap-1.5">
                    <span className="mt-0.5">⚠</span>
                    <span>{warning}</span>
                </p>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <ul className="space-y-0.5">
                    {suggestions.slice(0, 2).map((s, i) => (
                        <li key={i} className="font-body text-xs text-text-muted flex items-start gap-1.5">
                            <span className="text-primary mt-0.5">→</span>
                            <span>{s}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
