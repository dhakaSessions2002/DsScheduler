'use client';

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Shield, User, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const passwordResetSuccess = searchParams.get("reset") === "1";
    const registeredSuccess = searchParams.get("registered") === "1";

    const [mode, setMode] = useState("employee");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [requiresOtp, setRequiresOtp] = useState(false);
    const [otp, setOtp] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await authApi.login(email, password, requiresOtp ? otp : undefined);
            if (res.requiresOtp) {
                setRequiresOtp(true);
            } else {
                window.location.href = "/";
            }
        } catch (err) {
            setError(err.message || (requiresOtp ? "Invalid OTP" : "Invalid email or password"));
        } finally {
            setLoading(false);
        }
    };

    const forgotPasswordHref = email.trim()
        ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
        : "/forgot-password";

    return (
        <AuthLayout
            icon={LogIn}
            title="Dhaka Sessions"
            subtitle="Sign in to your account"
        >
            {/* Path selector */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-[6px] border border-[#333333] bg-[#080808] p-1">
                <PathButton
                    active={mode === "employee"}
                    onClick={() => setMode("employee")}
                    icon={User}
                    label="Employee"
                />
                <PathButton
                    active={mode === "admin"}
                    onClick={() => setMode("admin")}
                    icon={Shield}
                    label="Admin"
                />
            </div>

            {passwordResetSuccess && !error && (
                <div className="mb-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Your password has been reset. Sign in with your new password below.</span>
                </div>
            )}

            {registeredSuccess && !error && (
                <div className="mb-4 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Account created! Please sign in to verify your email.</span>
                </div>
            )}

            {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#C4C4C4]">Email</Label>
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
                            readOnly={requiresOtp}
                            required
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-[#C4C4C4]">Password</Label>
                        <Link href={forgotPasswordHref} className="text-xs text-[#C4C4C4] hover:text-[#FFFFFF] hover:underline">
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A3A3A3]" aria-hidden="true" />
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 pr-10 h-12 border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3] focus-visible:border-[#FFFFFF]"
                            readOnly={requiresOtp}
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
                </div>
                {requiresOtp && (
                    <div className="space-y-2 mt-4">
                        <Label htmlFor="otp" className="text-[#C4C4C4]">Verification Code</Label>
                        <p className="text-xs text-[#A3A3A3] mb-2">We sent a 6-digit code to your email.</p>
                        <Input
                            id="otp"
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="h-12 text-center text-lg tracking-[0.5em] border-[#333333] bg-[#080808] text-[#FFFFFF] placeholder:text-[#A3A3A3]"
                            maxLength={6}
                            required
                        />
                    </div>
                )}
                <Button type="submit" className="w-full h-12 font-medium bg-[#FFFFFF] text-[#080808] hover:bg-[#FFFFFF]/90" disabled={loading}>
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {requiresOtp ? "Verifying..." : "Signing in..."}
                        </>
                    ) : (
                        requiresOtp ? "Verify & Login" : (mode === "admin" ? "Admin sign in" : "Employee sign in")
                    )}
                </Button>
            </form>

            {mode === "employee" ? (
                <p className="text-center text-sm text-[#A3A3A3] mt-6">
                    New here?{" "}
                    <Link href="/register" className="text-[#FFFFFF] font-medium hover:underline">
                        Create an employee account
                    </Link>
                </p>
            ) : (
                <p className="text-center text-xs text-[#A3A3A3] mt-6">
                    Admin access is granted to the configured admin email only. Sign in with your admin credentials above.
                </p>
            )}
        </AuthLayout>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#080808]">
                    <Loader2 className="w-8 h-8 animate-spin text-[#FFFFFF]" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}

function PathButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center justify-center gap-2 rounded-[6px] px-3 py-2.5 text-[13px] font-medium transition-colors ${active
                    ? "bg-[#FFFFFF] text-[#080808] font-semibold"
                    : "text-[#C4C4C4] hover:text-[#FFFFFF]"
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}
