const mongoose = require('mongoose');
const User = require('../models/User');
const Spaces = require('../models/Space');
const Task = require('../models/Task');

exports.getUserInfo = async (req, res) => {
    try {
        const userId = req.params.userId;
        const spaceId = req.query.spaceId;
        const isModal = req.query.modal === 'true';

        // ข้อมูลผู้ใช้
        const user = await User.findById(userId)
            .select('username profileImage firstName lastName googleEmail isOnline createdAt')
            .lean();

        if (!user) {
            return res.status(404).send('User not found');
        }

        let collaborator = null;
        let spaces = [];
        let tasksInThisProject = [];
        let progressPercentage = 0;
        let totalTasks = 0;
        let completedTasks = 0;

        // ถ้ามี spaceId ให้หาข้อมูลบทบาทและงานที่มอบหมาย
        if (spaceId) {
            const space = await Spaces.findOne({ _id: spaceId })
                .select('collaborators name projectDueDate')
                .lean();

            if (space) {
                collaborator = space.collaborators.find(c => c.user && c.user.toString() === userId);
                
                // หางานที่มอบหมายให้ผู้ใช้ในโปรเจกต์นี้
                const assignedTasks = await Task.find({
                    project: spaceId,
                    assignedUsers: userId
                })
                .select('_id taskName taskStatus dueDate')
                .lean();

                // คำนวณสถิติงาน
                totalTasks = assignedTasks.length;
                completedTasks = assignedTasks.filter(task => task.taskStatus === 'finished').length;
                progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                // จัดรูปแบบข้อมูล Task
                tasksInThisProject = assignedTasks.map(task => ({
                    id: task._id,
                    taskName: task.taskName,
                    taskStatus: task.taskStatus,
                    dueDate: task.dueDate || space.projectDueDate,
                    projectName: space.name,
                    hasDueDate: !!(task.dueDate || space.projectDueDate)
                }));
            }
        }

        // หาโปรเจกต์ทั้งหมดที่ผู้ใช้ร่วมอยู่
        const userSpaces = await Spaces.find({
            $or: [
                { user: userId },
                { 'collaborators.user': userId }
            ]
        })
        .select('name collaborators user projectDueDate')
        .lean();

        spaces = userSpaces.map(space => {
            let role = 'member';
            
            if (space.user && space.user.toString() === userId) {
                role = 'owner';
            } else {
                const collab = space.collaborators.find(c => 
                    c.user && c.user.toString() === userId
                );
                if (collab) role = collab.role;
            }
            
            return {
                _id: space._id,
                name: space.name,
                role: role,
                projectDueDate: space.projectDueDate
            };
        });

        if (isModal) {
            res.render('user/user-infor', {
                user,
                collaborator,
                spaces,
                tasksInThisProject,
                progressPercentage,
                totalTasks,
                completedTasks,
                layout: false
            });
        } else {
            res.render('user/user-infor-full', {
                user,
                collaborator,
                spaces,
                tasksInThisProject,
                progressPercentage,
                totalTasks,
                completedTasks,
                layout: '../views/layouts/user-info'
            });
        }

    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).send('Internal Server Error');
    }
};