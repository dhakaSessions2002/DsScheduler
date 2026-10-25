import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { seedAdmin } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

const RESET_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_MS = 45 * 1000; // 45 seconds cooldown to prevent email flooding

function sha256(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export async function POST(request) {
    try {
        await dbConnect();
        await seedAdmin();

        const body = await request.json().catch(() => ({}));
        const email = (body.email || '').trim().toLowerCase();

        if (!email || !email.includes('@')) {
            return NextResponse.json(
                { error: 'Please enter a valid email address' },
                { status: 400 }
            );
        }

        const user = await User.findOne({ email });
        if (!user) {
            // Do not reveal whether the email is registered (prevents account enumeration)
            return NextResponse.json({ ok: true });
        }

        // Prevent rapid email flooding for the same account
        if (
            user.reset_requested_at &&
            user.reset_expires &&
            user.reset_expires > new Date() &&
            Date.now() - new Date(user.reset_requested_at).getTime() < RESEND_COOLDOWN_MS
        ) {
            return NextResponse.json({ ok: true, throttled: true });
        }

        const rawToken = crypto.randomBytes(32).toString('hex');
        const rawOtp = crypto.randomInt(100000, 1000000).toString();

        user.reset_token_hash = sha256(rawToken);
        user.reset_otp_hash = sha256(rawOtp);
        user.reset_expires = new Date(Date.now() + RESET_EXPIRY_MS);
        user.reset_requested_at = new Date();
        user.reset_attempts = 0;
        await user.save();

        const origin =
            request.headers.get('origin') ||
            process.env.NEXTAUTH_URL ||
            new URL(request.url).origin ||
            'http://localhost:3000';

        const resetLink = `${origin}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

        try {
            await sendPasswordResetEmail(user.email, resetLink, rawOtp);
        } catch (mailError) {
            console.error('Password reset email failed:', mailError);
            return NextResponse.json(
                { error: `Could not send password reset email: ${mailError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Forgot password error:', error);
        return NextResponse.json(
            { error: 'Unable to process password reset request' },
            { status: 500 }
        );
    }
}
