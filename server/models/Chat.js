const mongoose = require('mongoose');
const chatSchema = new mongoose.Schema({
    spaceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Space',
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    message: {
        type: String,
        required: function () {
            return !this.files || this.files.length === 0;
        }
    },
    files: [{
        url: String,
        originalname: String,
        mimetype: String,
        size: Number,
        filename: String
    }],
    type: {
        type: String,
        enum: ['group', 'private'],
        default: 'group',
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    mentionedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Chat', chatSchema);