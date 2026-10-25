import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    full_name: {
        type: String,
        default: '',
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user',
    },
    otp_code: {
        type: String,
        default: null,
    },
    otp_expires: {
        type: Date,
        default: null,
    },
    reset_token_hash: {
        type: String,
        default: null,
    },
    reset_otp_hash: {
        type: String,
        default: null,
    },
    reset_expires: {
        type: Date,
        default: null,
    },
    reset_requested_at: {
        type: Date,
        default: null,
    },
    reset_attempts: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' },
});

// In Next.js dev mode, ensure schema updates are applied if the model was already compiled
if (mongoose.models.User && !mongoose.models.User.schema.path('reset_token_hash')) {
    delete mongoose.models.User;
}

export default mongoose.models.User || mongoose.model('User', UserSchema);
