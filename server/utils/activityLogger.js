const UserActivity = require('../models/UserActivity');

const logUserActivity = async (userId, action, details = '') => {
    try {
        await UserActivity.create({ user: userId, action, details });
    } catch (error) {
        console.error("Error logging user activity:", error);
    }
};

module.exports = logUserActivity;
