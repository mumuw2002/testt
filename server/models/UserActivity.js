const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true }, // เช่น 'create_task', 'update_task', 'delete_task'
    details: { type: String }, // รายละเอียดของกิจกรรม
    timestamp: { type: Date, default: Date.now }
});

const UserActivity = mongoose.model('UserActivity', userActivitySchema);
module.exports = UserActivity;
