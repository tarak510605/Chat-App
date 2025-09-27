const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long'],
        maxlength: [20, 'Username cannot exceed 20 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    profile: {
        displayName: {
            type: String,
            default: function() { return this.username; }
        },
        bio: {
            type: String,
            maxlength: [150, 'Bio cannot exceed 150 characters'],
            default: ''
        },
        avatar: {
            type: String,
            default: function() {
                // Generate a simple avatar based on username
                return `https://ui-avatars.com/api/?name=${this.username}&background=667eea&color=fff&size=100`;
            }
        },
        joinedDate: {
            type: Date,
            default: Date.now
        }
    },
    verification: {
        isVerified: {
            type: Boolean,
            default: false
        },
        verificationBadge: {
            type: String,
            enum: ['none', 'verified', 'premium', 'admin'],
            default: 'none'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: null
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const hashedPassword = await bcrypt.hash(this.password, 12);
        this.password = hashedPassword;
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Remove password from JSON output and format profile info
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
};

// Method to get public profile (for other users to see)
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        username: this.username,
        profile: {
            displayName: this.profile.displayName,
            bio: this.profile.bio,
            avatar: this.profile.avatar,
            joinedDate: this.profile.joinedDate
        },
        verification: this.verification,
        isOnline: this.isOnline,
        lastSeen: this.lastSeen
    };
};

// Static method to find user by email or username
userSchema.statics.findByEmailOrUsername = function(identifier) {
    return this.findOne({
        $or: [
            { email: identifier },
            { username: identifier }
        ]
    });
};

const User = mongoose.model('User', userSchema);

module.exports = User;