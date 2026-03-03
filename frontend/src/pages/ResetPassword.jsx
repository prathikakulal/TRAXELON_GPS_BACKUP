import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import PasswordStrength from "../components/PasswordStrength";
import { analyzePassword, MIN_SCORE } from "../utils/passwordStrength";

export default function ResetPassword() {
    const { confirmReset } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [oobCode, setOobCode] = useState(null);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Derived — recalculated on every render with new password value
    const passwordStrength = analyzePassword(password);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get("oobCode");
        if (code) {
            setOobCode(code);
        } else {
            setError("Invalid or missing password reset link.");
        }
    }, [location.search]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setMessage("");

        if (!oobCode) {
            return setError("Invalid reset link. Please request a new one.");
        }
        if (password !== confirmPassword) {
            return setError("Passwords do not match.");
        }
        if (password.length < 12 || password.length > 16) {
            return setError("Password must be 12-16 characters.");
        }
        if (passwordStrength.score < MIN_SCORE) {
            return setError("Password is too weak. Please choose a stronger password (Good or better).");
        }

        setLoading(true);
        try {
            await confirmReset(oobCode, password);
            setMessage("Password has been reset successfully. You can now log in.");
            setTimeout(() => {
                navigate("/login");
            }, 3000);
        } catch (err) {
            setError(
                err.message ||
                "Failed to reset password. The link may have expired."
            );
        }
        setLoading(false);
    }

    const submitDisabled =
        loading ||
        !oobCode ||
        !!message ||
        (password.length > 0 && passwordStrength.score < MIN_SCORE);

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center px-4 pt-16 pb-8">
            <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20 pointer-events-none" />
            <div className="relative w-full max-w-md">
                <div className="bg-surface-elevated border border-surface-border rounded-2xl p-8 shadow-card">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/30 rounded-2xl mb-4">
                            <Shield className="w-7 h-7 text-primary" />
                        </div>
                        <h1 className="font-display text-3xl tracking-wider text-text-primary">
                            SET NEW <span className="text-primary">PASSWORD</span>
                        </h1>
                        <p className="font-body text-sm text-text-secondary mt-2">
                            Enter a new secure password for your account
                        </p>
                    </div>

                    {error && (
                        <div className="bg-accent/10 border border-accent/30 text-accent rounded-lg px-4 py-3 font-body text-sm mb-6">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 text-primary rounded-lg px-4 py-3 font-body text-sm mb-6">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p>{message}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* New Password */}
                        <div>
                            <label className="block font-body text-xs text-text-secondary uppercase tracking-wider mb-1.5">
                                New Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type={showPass ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="12-16 characters"
                                    required
                                    disabled={!oobCode || !!message}
                                    className="w-full bg-surface border border-surface-border rounded-lg pl-10 pr-10 py-3 font-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    disabled={!oobCode || !!message}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary disabled:opacity-50"
                                >
                                    {showPass ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {/* Strength meter */}
                            <PasswordStrength password={password} />
                        </div>

                        {/* Confirm New Password */}
                        <div>
                            <label className="block font-body text-xs text-text-secondary uppercase tracking-wider mb-1.5">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    required
                                    disabled={!oobCode || !!message}
                                    className="w-full bg-surface border border-surface-border rounded-lg pl-10 pr-4 py-3 font-body text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitDisabled}
                            className="w-full mt-6 px-6 py-3.5 bg-primary text-surface font-body font-bold rounded-lg hover:bg-primary-dark transition-all shadow-glow hover:shadow-glow-strong disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>

                    <div className="text-center mt-6">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 font-body text-sm text-text-muted hover:text-primary transition-colors"
                        >
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
