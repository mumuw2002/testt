const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    url: { type: String, required: true },
    originalname: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    filename: { type: String, required: true }
}, { _id: false });

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
        required: function() {
            return this.files.length === 0; // ข้อความจำเป็นถ้าไม่มีไฟล์แนบ
        },
    },
    files: [fileSchema], // ฟิลด์ใหม่สำหรับเก็บไฟล์แนบ
    createdAt: {
        type: Date,
        default: Date.now,
    },
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
    timestamps: true // เพิ่ม createdAt และ updatedAt อัตโนมัติ
});

module.exports = mongoose.model('Chat', chatSchema);