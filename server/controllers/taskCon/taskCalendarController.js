const Task = require("../../models/Task");
const Spaces = require('../../models/Space');
const moment = require('moment');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.getCalendar = async (req, res) => {
    try {
        const spaceId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(spaceId)) {
            return res.status(400).send("Invalid space ID.");
        }

        const space = await Spaces.findById(spaceId);
        if (!space) {
            return res.status(404).send("Space not found.");
        }

        // ดึงงานทั้งหมดใน space นี้
        const tasks = await Task.find({
            project: spaceId,
            dueDate: { $exists: true, $ne: null } // เฉพาะงานที่มี dueDate
        }).populate('assignedUsers', 'displayName profileImage');

        // จัดรูปแบบข้อมูลสำหรับ FullCalendar
        const events = tasks.map(task => ({
            id: task._id,
            title: task.taskName,
            start: task.dueDate,
            allDay: true,
            extendedProps: {
                description: task.taskDetail || '',
                assignedUsers: task.assignedUsers,
                status: task.taskStatus,
                spaceId: spaceId
            }
        }));

        res.render("task/task-calendar", {
            spaces: space,
            spaceId,
            events: JSON.stringify(events),
            user: req.user,
            userName: req.user.firstName,
            userImage: req.user.profileImage,
            currentPage: 'task_calenda',
            layout: "../views/layouts/task"
        });
    } catch (error) {
        console.error('Error fetching calendar data:', error);
        res.status(500).send("Internal Server Error");
    }
};