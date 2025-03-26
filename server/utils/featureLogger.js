const FeatureUsage = require('../models/FeatureUsage');

const logFeatureUsage = async (featureName) => {
    try {
        await FeatureUsage.findOneAndUpdate(
            { featureName },
            { $inc: { count: 1 } }, // เพิ่ม count +1
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error("Error logging feature usage:", error);
    }
};

module.exports = logFeatureUsage;
