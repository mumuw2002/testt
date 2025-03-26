// Task Models
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attachmentSchema = new Schema({
    path: String, 
    originalName: String,
    uploadedAt: { type: Date, default: Date.now },
    fileSize: Number,
});

const activityLogSchema = new Schema({
    text: { type: String },
    type: { type: String, enum: ['normal', 'comment'], default: 'normal' },
    createdBy: { type: Schema.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
});

const taskSchema = new Schema({
    user: { type: Schema.ObjectId, ref: 'User', required: true },
    project: { type: Schema.ObjectId, ref: 'Space', required: true },

    taskName: {
        type: String,
        required: true,
    },
    taskDetail: {
        type: String,
        default: "",
    },
    startDate: {
        type: Date,
        default: null
    },
    dueDate: {
        type: Date,
        default: null
    },
    dueTime: {
        type: String,
        validate: {
            validator: function (v) {
                return v === null || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
            },
            message: props => `${props.value} is not a valid time! Expected format is HH:mm.`
        }
    },
    taskStatus: {
        type: String,
        enum: ['toDo', 'inProgress', 'fix', 'finished'],
        required: true,
    },      
    taskPriority: {
        type: String,
        enum: ['urgent', 'normal', 'low'],
        default: 'normal'
    },

    // Relationships and organizational features
    taskTags: [{ type: String }],
    assignedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    subtasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

    // Additional features
    activityLogs: [activityLogSchema],
    attachments: [attachmentSchema],
    deleted: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

const Task = mongoose.model('Tasks', taskSchema);
module.exports = Task;