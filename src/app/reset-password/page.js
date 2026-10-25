'use client';

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Lock,
    Loader2,
    AlertTriangle,
    Eye,
    EyeOff,
    Sparkles,
    Copy,
    Check,
    CheckCircle2,
    ArrowLeft,
} from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

function generateStrongPassword(length = 14) {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "!@#$%&*_-+=";
    const all = upper + lower + digits + symbols;

    const rand = (max) => {
        if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            return arr[0] % max;
        }
        return Math.floor(Math.random() * max);
    };

    // Guarantee at least one character from each category
    const chars = [
        upper[rand(upper.length)],
        lower[rand(lower.length)],
        digits[rand(digits.length)],
        symbols[rand(symbols.length)],
    ];

    for (let i = chars.length; i < length; i++) {
        chars.push(all[rand(all.length)]);
    }

    // Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join("");
}

function evaluatePasswordStrength(pw) {
    if (!pw) return { score: 0, label: "", color: "bg-[#262626]" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (pw.length < 6) {
        return { score: 1, label: "Too short (min 6 characters)", color: "bg-red-500" };
    }
    if (score <= 2) {
        return { score: 2, label: "Fair", color: "bg-amber-500" };
    }
    if (score <= 3) {
        return { score: 3, label: "Good", color: "bg-blue-500" };
    }
    return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const resetToken = searchParams.get("token") || "";
    const emailParam = searchParams.get("email") || "";
    const codeParam = searchParams.get("code") || "";

    const [verifyingLink, setVerifyingLink] = useState(true);
    const [linkValid, setLinkValid] = useState(false);
    const [verifiedEmail, setVerifiedEmail] = useState(emailParam);
    const [linkError, setLinkError] = useState("");

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const hasCredentials = Boolean(resetToken || (emailParam && codeParam));

    useEffect(() => {
        let active = true;
        if (!hasCredentials) {
            setVerifyingLink(false);
            setLinkValid(false);
            setLinkError("This password reset link is incomplete or missing required parameters.");
            return;
        }

        authApi
            .verifyResetToken({ token: resetToken, email: emailParam, code: codeParam })
            .then((res) => {
                if (!active) return;
                setLinkValid(true);
                if (res.email) setVerifiedEmail(res.email);
            })
            .catch((err) => {
                if (!active) return;
                setLinkValid(false);
                setLinkError(err.message || "This password reset link is invalid or has expired.");
            })
            .finally(() => {
                if (active) setVerifyingLink(false);
            });

        return () => {
            active = false;
        };
    }, [resetToken, emailParam, codeParam, hasCredentials]);

    const strength = useMemo(() => evaluatePasswordStrength(newPassword), [newPassword]);

    const handleGeneratePassword = () => {
        const generated = generateStrongPassword(14);
        setNewPassword(generated);
        setConfirmPassword(generated);
        setShowPassword(true);
        setShowConfirm(true);
        setError("");
        setCopied(false);
    };

    const handleCopyPassword = async () => {
        if (!newPassword) return;
        try {
            await navigator.clipboard.writeText(newPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Ignore clipboard errors
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            await authApi.resetPassword({
                token: resetToken || undefined,
                email: emailParam || undefined,
                code: codeParam || undefined,
                newPassword,
            });
            setSuccess(true);
            setTimeout(() => {
                router.push("/login?reset=1");
            }, 1500);
        } catch (err) {
            setError(err.message || "Failed to reset password");
        } finally {
            setLoading(false);
        }
    };

    if (verifyingLink) {
        return (
            <AuthLayout
                icon={Lock}
                title="Verifying reset link"
                subtitle="Please wait while we validate your security token..."
            >
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Loader2 className="w-7 h-7 animate-spin text-[#FFFFFF]" />
                    <p className="text-xs text-[#A3A3A3]">Checking reset credentials...</p>
                </div>
            </AuthLayout>
        );
    }

    if (!linkValid) {
        return (
            <AuthLayout
                icon={AlertTriangle}
                title="Invalid or expired link"
                subtitle="We couldn't verify this password reset request"
                footer={
                    <Link href="/login" className="inline-flex items-center text-[#FFFFFF] font-medium hover:underline">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                        Back to sign in
                    </Link>
                }
            >
                <div className="space-y-4 text-center">
                    <p className="text-sm text-[#C4C4C4] leading-relaxed">
                        {linkError || "The password reset link or code has expired or has already been used."}
                    </p>
                    <Link href={`/forgot-password${emailParam ? `?email=${encodeURIComponent(emailParam)}` : ""}`} className="block">
                        <Button className="w-full h-12 font-medium bg-[#FFFFFF] text-[#080808] hover:bg-[#FFFFFF]/90">
                            Request a new reset link
                        </Button>
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    if (success) {
        return (
            <AuthLayout
                icon={CheckCircle2}
                title="Password updated!"
                subtitle="Your new password is now active"
            >
                <div className="space-y-4 text-center">
                    <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
                        Your password has been reset successfully. Redirecting you to sign in...
                    </div>
                    <Link href="/login?reset=1" className="block">
                        <Button className="w-full h-12 font-medium bg-[#FFFFFF] text-[#080808] hover:bg-[#FFFFFF]/90">
                            Continue to sign in
                        </Button>
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            icon={Lock}
            title="Set new password"
            subtitle={
                verifiedEmail
                    ? `Create or generate a new password for ${verifiedEmail}`
                    : "Enter or generate a strong new password below"
            }
            footer={
                <Link href="/login" className="inline-flex items-center text-[#FFFFFF] font-medium hover:underline">
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                    Back to sign in
                </Link>
            }
        >
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[#C4C4C4]">New Password</Label>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleGeneratePassword}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#FFFFFF] bg-[#262626] hover:bg-[#333333] px-2.5 py-1 rounded-md transition-colors"
                                title="Auto-generate a strong password"
                            >
                                <Sparkles className="w-3 h-3" />
                                Generate strong password
                            </button>
                            {newPassword && (
                                <button
                                    type="button"
                                    onClick={handleCopyPassword}
                                    className="inline-flex items-center gap-1 text-xs text-[#C4C4C4] hover:text-[#FFFFFF] bg-[#1F1F1F] hover:bg-[#2A2A2A] px-2 py-1 rounded-md transition-colors"
                                    title="Copy password to clipboard"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3 h-3 text-emerald-400" />
                                            <span className="text-emerald-400">Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3 h-3" />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" aria-hidden="true" />
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            autoFocus
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="pl-10 pr-10 h-12 border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3] focus-visible:border-[#FFFFFF]"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#FFFFFF] transition-colors"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {newPassword && (
                        <div className="space-y-1.5 pt-1">
                            <div className="grid grid-cols-4 gap-1.5">
                                {[1, 2, 3, 4].map((level) => (
                                    <div
                                        key={level}
                                        className={`h-1 rounded-full transition-colors ${strength.score >= level ? strength.color : "bg-[#262626]"
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="text-[11px] text-[#A3A3A3] flex justify-between">
                                <span>Password strength: <strong className="text-[#FFFFFF]">{strength.label}</strong></span>
                                <span>{newPassword.length} chars</span>
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirm" className="text-[#C4C4C4]">Confirm New Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" aria-hidden="true" />
                        <Input
                            id="confirm"
                            type={showConfirm ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-10 pr-10 h-12 border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3] focus-visible:border-[#FFFFFF]"
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#FFFFFF] transition-colors"
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    className="w-full h-12 font-medium bg-[#FFFFFF] text-[#080808] hover:bg-[#FFFFFF]/90"
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving new password...
                        </>
                    ) : (
                        "Reset password"
                    )}
                </Button>
            </form>
        </AuthLayout>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#080808]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FFFFFF]" />
                </div>
            }
        >
            <ResetPasswordContent />
        </Suspense>
    );
}
