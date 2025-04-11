const express = require('express');
const router = express.Router();
const taskCalendarController = require('../../controllers/taskCon/taskCalendarController');
const { isLoggedIn } = require('../../middleware/checkAuth');

// เพิ่ม route สำหรับปฏิทิน
router.get('/space/item/:id/calendar', isLoggedIn, taskCalendarController.getCalendar);

module.exports = router;