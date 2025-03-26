const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notificationSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  subTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubTask'
  },
  space: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Spaces' 
  }, 
  leader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String, enum: ['taskAssignment', 'subtaskAssignment', 'invitation', 'roleChange', 'removal', 'memberAdded'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'pending', 'accepted', 'declined'],
    default: 'unread'
  },
  dueDate: Date,
  announcement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemAnnouncement'
  },
  createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;