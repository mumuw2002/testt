// Status models
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const statusSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['toDo', 'inProgress', 'fix','finished'],
        required: true
    },
    space: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Space',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Status', statusSchema);