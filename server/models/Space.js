//Space Model
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const collaboratorSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { 
        type: String, 
        enum: ['owner', 'admin', 'member', 'Guest'], 
        default: 'member'
    },
    joinDate: { type: Date, default: Date.now }
});

const spaceSchema = new Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    projectName: {
        type: String,
        required: true
    },
    projectDetail: {
        type: String
    },
    projectDueDate: {
        type: Date,
        default: null
    },
    collaborators: [collaboratorSchema],
    deleted: {
        type: Boolean,
        default: false
    },
    projectCover: {
        type: String,
        default: "/public/spacePictures/defultBackground.jpg"
    },
}, {
    timestamps: true 
});

const Spaces = mongoose.model('Spaces', spaceSchema);
module.exports = Spaces;