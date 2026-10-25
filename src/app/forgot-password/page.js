'use client';

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, KeyRound, CheckCircle2, RefreshCw } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

function ForgotPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [code, setCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        const qEmail = searchParams.get("email");
        if (qEmail) setEmail(qEmail);
    }, [searchParams]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleSendReset = async (e) => {
        if (e) e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await authApi.forgotPassword(email.trim());
            setSent(true);
            setCooldown(45);
        } catch (err) {
            setError(err.message || "Failed to send password reset email. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setError("");
        const cleanCode = code.trim();
        if (cleanCode.length !== 6) {
            setError("Please enter the 6-digit verification code from your email.");
            return;
        }
        setVerifying(true);
        try {
            await authApi.verifyResetToken({ email: email.trim(), code: cleanCode });
            router.push(`/reset-password?email=${encodeURIComponent(email.trim())}&code=${encodeURIComponent(cleanCode)}`);
        } catch (err) {
            setError(err.message || "Invalid or expired verification code.");
        } finally {
            setVerifying(false);
        }
    };

    return (
        <AuthLayout
            icon={Mail}
            title={sent ? "Check your email" : "Forgot password?"}
            subtitle={
                sent
                    ? "Use the reset link or enter the 6-digit code we sent you"
                    : "Enter your account email and we'll send a reset link and verification code"
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

            {sent ? (
                <div className="space-y-5">
                    <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs leading-relaxed flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                        <div>
                            If an account exists for <span className="font-semibold text-[#FFFFFF]">{email}</span>, we&apos;ve sent a password reset link and a 6-digit verification code (valid for 15 minutes).
                        </div>
                    </div>

                    <form onSubmit={handleVerifyCode} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code" className="text-[#C4C4C4]">
                                6-Digit Verification Code
                            </Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" aria-hidden="true" />
                                <Input
                                    id="code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    autoFocus
                                    placeholder="Enter 6-digit code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="pl-10 h-12 text-center text-lg tracking-[0.4em] font-mono border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3] placeholder:tracking-normal placeholder:font-sans placeholder:text-sm focus-visible:border-[#FFFFFF]"
                                    maxLength={6}
                                    required
                                />
                            </div>
                            <p className="text-[11px] text-[#A3A3A3]">
                                You can also click the &ldquo;Reset Password&rdquo; button directly inside the email.
                            </p>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 font-medium bg-[#FFFFFF] text-[#080808] hover:bg-[#FFFFFF]/90"
                            disabled={verifying || code.length !== 6}
                        >
                            {verifying ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Verifying code...
                                </>
                            ) : (
                                "Verify code & set new password"
                            )}
                        </Button>
                    </form>

                    <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs text-[#A3A3A3]">
                        <button
                            type="button"
                            onClick={() => {
                                setSent(false);
                                setCode("");
                                setError("");
                            }}
                            className="hover:text-[#FFFFFF] transition-colors"
                        >
                            Change email
                        </button>
                        <button
                            type="button"
                            disabled={cooldown > 0 || loading}
                            onClick={handleSendReset}
                            className="inline-flex items-center gap-1.5 text-[#C4C4C4] hover:text-[#FFFFFF] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSendReset} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-[#C4C4C4]">Email address</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" aria-hidden="true" />
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                autoFocus
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-10 h-12 border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3] focus-visible:border-[#FFFFFF]"
                                required
                            />
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
                                Sending instructions...
                            </>
                        ) : (
                            "Send reset link & code"
                        )}
                    </Button>
                </form>
            )}
        </AuthLayout>
    );
}

export default function ForgotPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#080808]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FFFFFF]" />
                </div>
            }
        >
            <ForgotPasswordContent />
        </Suspense>
    );
}
