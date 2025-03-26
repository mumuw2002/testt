const mongoose = require('mongoose');

const featureUsageSchema = new mongoose.Schema({
    featureName: { type: String, required: true }, // ชื่อฟีเจอร์ เช่น 'create_task', 'update_task'
    count: { type: Number, default: 0 }
});

const FeatureUsage = mongoose.model('FeatureUsage', featureUsageSchema);
module.exports = FeatureUsage;
