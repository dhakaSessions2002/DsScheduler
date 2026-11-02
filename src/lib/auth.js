import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dbConnect from './dbConnect';
import User from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hashed) {
    return bcrypt.compare(password, hashed);
}

// Extract the JWT from Authorization header or cookie
export function getTokenFromRequest(request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    // Check cookies
    const cookie = request.headers.get('cookie');
    if (cookie) {
        const match = cookie.match(/ds_token=([^;]+)/);
        if (match) return match[1];
    }
    return null;
}

// Get the authenticated user from the request
export async function getAuthUser(request) {
    const token = getTokenFromRequest(request);
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    await dbConnect();
    const user = await User.findById(decoded.userId).select('-password').lean();
    if (!user) return null;

    return {
        id: user._id.toString(),
        email: user.email,
        full_name: user.full_name || '',
        role: user.role,
    };
}

// Seed the admin user on first run
export async function seedAdmin() {
    await dbConnect();
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) return;

    const existing = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!existing) {
        const hashed = await hashPassword(adminPassword);
        await User.create({
            email: adminEmail.toLowerCase(),
            password: hashed,
            full_name: 'Admin',
            role: 'admin',
        });
        console.log('Admin user seeded:', adminEmail);
    } else {
        let changed = false;
        if (existing.role !== 'admin') {
            existing.role = 'admin';
            changed = true;
        }
        const isMatch = await comparePassword(adminPassword, existing.password);
        if (!isMatch) {
            existing.password = await hashPassword(adminPassword);
            changed = true;
        }
        if (changed) {
            await existing.save();
            console.log('Admin user updated:', adminEmail);
        }
    }
}
