import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT) || 587;

export const transporter = nodemailer.createTransport({
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
    port: smtpPort,
    secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: (process.env.EMAIL_USER || '').trim(),
        pass: (process.env.EMAIL_PASS || '').replace(/\s+/g, ''),
    },
});

// Returns true when real email can be sent. In production a missing config is an error
// (otherwise the OTP would silently never be delivered); locally we fall back to the terminal.
function emailConfigured() {
    const ok = Boolean((process.env.EMAIL_USER || '').trim() && (process.env.EMAIL_PASS || '').trim());
    if (!ok && process.env.NODE_ENV === 'production') {
        throw new Error('Email service is not configured on the server (EMAIL_USER / EMAIL_PASS missing in Vercel environment variables)');
    }
    return ok;
}

export async function sendInviteEmail(email, inviteLink) {
    if (!emailConfigured()) {
        console.log(`[DEV EMAIL] Would send invite to ${email} with link: ${inviteLink}`);
        return;
    }

    await transporter.sendMail({
        from: `"DS Scheduler" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'You have been invited to DS Scheduler',
        html: `
            <div style="font-family: sans-serif; max-w-xl mx-auto p-4 border rounded shadow-sm">
                <h2 style="color: #333;">Welcome to DS Scheduler!</h2>
                <p>An administrator has invited you to join the workspace.</p>
                <p>Please click the link below to create your account. Your access will be automatically approved upon registration.</p>
                <div style="margin: 30px 0;">
                    <a href="${inviteLink}" style="background-color: #080808; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invite & Register</a>
                </div>
                <p style="color: #666; font-size: 12px;">If the button doesn't work, copy this link: ${inviteLink}</p>
            </div>
        `,
    });
}

export async function sendOtpEmail(email, otp) {
    if (!emailConfigured()) {
        console.log(`[DEV EMAIL] OTP for ${email} is: ${otp}`);
        return;
    }

    await transporter.sendMail({
        from: `"DS Scheduler" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your Login Verification Code',
        html: `
            <div style="font-family: sans-serif; max-w-xl mx-auto p-4 border rounded shadow-sm text-center">
                <h2 style="color: #333;">Login Verification</h2>
                <p>Use the following 6-digit code to complete your login:</p>
                <div style="margin: 30px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #080808;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 12px;">This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    });
}

export async function sendPasswordResetEmail(email, resetLink, otpCode) {
    if (!emailConfigured()) {
        console.log(`[DEV EMAIL] Password reset for ${email}`);
        console.log(`[DEV EMAIL] Reset Code: ${otpCode}`);
        console.log(`[DEV EMAIL] Reset Link: ${resetLink}`);
        return;
    }

    await transporter.sendMail({
        from: `"DS Scheduler" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Reset Your DS Scheduler Password',
        html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 10px;">
                <h2 style="color: #111; margin-top: 0;">Password Reset Request</h2>
                <p style="color: #333; line-height: 1.5;">
                    We received a request to reset the password for your DS Scheduler account (<strong>${email}</strong>).
                </p>
                <p style="color: #333; line-height: 1.5;">
                    Click the button below to choose or generate a new password:
                </p>
                <div style="margin: 28px 0; text-align: center;">
                    <a href="${resetLink}" style="background-color: #080808; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p style="color: #333; line-height: 1.5; text-align: center;">
                    Or enter this 6-digit verification code on the password reset page:
                </p>
                <div style="margin: 16px 0 24px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #080808; text-align: center; background: #f5f5f5; padding: 14px; border-radius: 8px;">
                    ${otpCode}
                </div>
                <p style="color: #666; font-size: 12px; line-height: 1.5;">
                    This link and code will expire in <strong>15 minutes</strong> and can only be used once. If you did not request a password reset, you can safely ignore this email—your password will remain unchanged.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #888; font-size: 11px; word-break: break-all;">
                    If the button above doesn't work, copy and paste this URL into your browser:<br />
                    ${resetLink}
                </p>
            </div>
        `,
    });
}

export async function sendPasswordChangedEmail(email) {
    if (!emailConfigured()) {
        console.log(`[DEV EMAIL] Password changed confirmation for ${email}`);
        return;
    }

    await transporter.sendMail({
        from: `"DS Scheduler" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your DS Scheduler Password Was Changed',
        html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 10px;">
                <h2 style="color: #111; margin-top: 0;">Password Updated Successfully</h2>
                <p style="color: #333; line-height: 1.5;">
                    The password for your DS Scheduler account (<strong>${email}</strong>) was just changed.
                </p>
                <p style="color: #666; font-size: 13px; line-height: 1.5;">
                    If you made this change, no further action is needed. If you did not authorize this change, please reset your password immediately or contact your workspace administrator.
                </p>
            </div>
        `,
    });
}
