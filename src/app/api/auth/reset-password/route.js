import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { hashPassword, comparePassword } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';

const MAX_RESET_ATTEMPTS = 5;

function sha256(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function timingSafeHexEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
        return false;
    }
}

async function clearResetFields(user) {
    user.reset_token_hash = null;
    user.reset_otp_hash = null;
    user.reset_expires = null;
    user.reset_requested_at = null;
    user.reset_attempts = 0;
    await user.save();
}

async function verifyResetCredentials({ token, email, code }) {
    if (token) {
        const tokenHash = sha256(token.trim());
        const user = await User.findOne({ reset_token_hash: tokenHash });
        if (!user) {
            return {
                error: 'Invalid or expired password reset link. Please request a new one.',
                status: 400,
            };
        }
        if (!user.reset_expires || user.reset_expires < new Date()) {
            await clearResetFields(user);
            return {
                error: 'This password reset link has expired. Please request a new one.',
                status: 400,
            };
        }
        return { user };
    }

    if (email && code) {
        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = String(code).trim();
        const user = await User.findOne({ email: cleanEmail });

        if (!user || !user.reset_otp_hash || !user.reset_expires) {
            return {
                error: 'Invalid or expired verification code. Please request a new one.',
                status: 400,
            };
        }

        if (user.reset_expires < new Date()) {
            await clearResetFields(user);
            return {
                error: 'Verification code has expired. Please request a new one.',
                status: 400,
            };
        }

        if ((user.reset_attempts || 0) >= MAX_RESET_ATTEMPTS) {
            await clearResetFields(user);
            return {
                error: 'Too many failed attempts. Please request a new verification code.',
                status: 429,
            };
        }

        const codeHash = sha256(cleanCode);
        if (!timingSafeHexEqual(codeHash, user.reset_otp_hash)) {
            user.reset_attempts = (user.reset_attempts || 0) + 1;
            if (user.reset_attempts >= MAX_RESET_ATTEMPTS) {
                await clearResetFields(user);
                return {
                    error: 'Too many failed attempts. Please request a new verification code.',
                    status: 429,
                };
            }
            await user.save();
            return {
                error: 'Invalid verification code. Please check your email and try again.',
                status: 400,
            };
        }

        return { user };
    }

    return {
        error: 'Reset token or verification code is required.',
        status: 400,
    };
}

export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token') || '';
        const email = searchParams.get('email') || '';
        const code = searchParams.get('code') || '';

        const result = await verifyResetCredentials({ token, email, code });
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            valid: true,
            email: result.user.email,
        });
    } catch (error) {
        console.error('Verify reset token error:', error);
        return NextResponse.json(
            { error: 'Failed to verify reset credentials' },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        await dbConnect();
        const body = await request.json().catch(() => ({}));
        const { token, email, code, newPassword } = body;

        if (!newPassword || typeof newPassword !== 'string') {
            return NextResponse.json(
                { error: 'New password is required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        if (newPassword.length > 128) {
            return NextResponse.json(
                { error: 'Password cannot exceed 128 characters' },
                { status: 400 }
            );
        }

        const result = await verifyResetCredentials({ token, email, code });
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        const { user } = result;

        // Prevent resetting to the exact same password
        const isSamePassword = await comparePassword(newPassword, user.password);
        if (isSamePassword) {
            return NextResponse.json(
                { error: 'New password must be different from your current password' },
                { status: 400 }
            );
        }

        user.password = await hashPassword(newPassword);
        user.reset_token_hash = null;
        user.reset_otp_hash = null;
        user.reset_expires = null;
        user.reset_requested_at = null;
        user.reset_attempts = 0;
        user.otp_code = null;
        user.otp_expires = null;
        await user.save();

        // Send security alert email (non-blocking if mail fails)
        try {
            await sendPasswordChangedEmail(user.email);
        } catch (mailErr) {
            console.error('Password changed notification email failed:', mailErr);
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
