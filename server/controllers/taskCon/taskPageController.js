/// task page controller
const Task = require("../../models/Task");
const Spaces = require('../../models/Space');
const Chat = require('../../models/Chat');
const SubTask = require('../../models/SubTask');
const User = require("../../models/User");
const Status = require('../../models/Status');
const Notification = require('../../models/Noti');
const moment = require('moment');
const mongoose = require('mongoose');
moment.locale('th');

const extractTaskParameters = async (tasks) => {
    const taskNames = tasks.map(task => task.taskName);
    const taskDetail = tasks.map(task => task.detail);
    const taskStatuses = tasks.map(task => task.taskStatuses);
    const taskTypes = tasks.map(task => task.taskType);
    const taskPriority = tasks.map(task => task.taskPriority);
    const taskTag = tasks.map(task => task.taskTag);

    const dueDate = tasks.map(task => {
        const date = moment(task.dueDate).locale('th'); // Set locale to Thai
        return {
            day: date.format('DD'),
            month: date.format('MMM'), // Use abbreviated Thai month names
            year: date.format('YYYY') // Buddhist calendar year (BE)
        };
    });

    const dueTime = tasks.map(task => task.dueTime);

    const createdAt = tasks.map(task => {
        const date = new Date(task.createdAt);
        const options = { day: 'numeric', month: 'long', year: 'numeric', locale: 'th-TH' };
        return date.toLocaleDateString(undefined, options);
    });

    return { taskNames, taskDetail, taskStatuses, taskTypes, dueDate, dueTime, createdAt, taskPriority, taskTag };
};
const formatDate = (date) => {
    return new Date(date).toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

/// Dashboard page controller
exports.task_dashboard = async (req, res) => {
    try {
        const spaceId = req.params.id;
        const userId = mongoose.Types.ObjectId(req.user.id);
        const period = req.query.period || '7day'; 

        // Find space and ensure access
        const space = await Spaces.findOne({
            _id: spaceId,
            $or: [{ user: userId }, { collaborators: { $elemMatch: { user: userId } } }],
        })
            .populate('collaborators.user', 'username profileImage googleEmail')
            .lean();

        if (!space) {
            return res.status(404).send("Space not found");
        }

        // Retrieve tasks and populate fields
        const tasks = await Task.find({ project: spaceId })
            .populate('assignedUsers', 'username profileImage')
            .populate('activityLogs.createdBy', 'username profileImage')
            .lean();

        // Determine the date range based on the selected period
        let startDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to the start of today

        switch (period) {
            case 'today':
                startDate = today; // Filter for tasks created today
                break;
            case '7day':
                startDate = new Date();
                startDate.setDate(today.getDate() - 7); // Filter for the past 7 days
                break;
            case '1month':
                startDate = new Date();
                startDate.setMonth(today.getMonth() - 1); // Filter for the past month
                break;
            case 'sinceCreate':
                startDate = new Date(0); // Start from the Unix epoch
                break;
            default:
                startDate = new Date();
                startDate.setDate(today.getDate() - 7); // Default to 7 days
        }

        // Determine the display value for the selected period
        let selectedPeriod;
        switch (period) {
            case 'today':
                selectedPeriod = 'วันนี้';
                break;
            case '7day':
                selectedPeriod = '7 วันที่ผ่านมา';
                break;
            case '1month':
                selectedPeriod = '1 เดือนที่ผ่านมา';
                break;
            case 'sinceCreate':
                selectedPeriod = 'ทั้งหมด';
                break;
            default:
                selectedPeriod = '7 วันวันที่ผ่านมา'; 
        }

        // Determine the display value for the selected period
        let periodText;
        switch (period) {
            case 'today':
                periodText = 'วันนี้';
                break;
            case '7day':
                periodText = 'ในช่วง 7 วันที่ผ่านมา';
                break;
            case '1month':
                periodText = 'ในช่วง 1 เดือนที่ผ่านมา';
                break;
            case 'sinceCreate':
                periodText = 'ตั้งแต่สร้างโปรเจกต์';
                break;
            default:
                periodText = 'ในช่วง 7 วันที่ผ่านมา'; // Default display text
        }

        // Filter tasks based on the selected period
        const filteredTasks = tasks.filter(task => new Date(task.createdAt) >= startDate);

        // Task Statistics
        const finishedTasksCount = filteredTasks.filter(task => task.taskStatus === 'finished').length;
        const updatedTasksCount = filteredTasks.filter(task => new Date(task.updatedAt) > new Date(task.createdAt)).length;
        const recentTasksCount = filteredTasks.length;

        const nextSevenDays = new Date();
        nextSevenDays.setDate(today.getDate() + 7);
        const dueNextSevenDaysCount = filteredTasks.filter(task => task.dueDate && new Date(task.dueDate) >= today && new Date(task.dueDate) <= nextSevenDays).length;

        // Status Chart
        const statusCounts = {
            toDo: filteredTasks.filter(task => task.taskStatus === 'toDo').length || 0,
            inProgress: filteredTasks.filter(task => task.taskStatus === 'inProgress').length || 0,
            fix: filteredTasks.filter(task => task.taskStatus === 'fix').length || 0,
            finished: filteredTasks.filter(task => task.taskStatus === 'finished').length || 0,
        };

        const totalTasks = filteredTasks.length;
        const statusPercentages = Object.fromEntries(
            Object.entries(statusCounts).map(([status, count]) => [status, ((count / totalTasks) * 100).toFixed(2)])
        );

        const finishedPercentage = totalTasks > 0 ? ((statusCounts.finished / totalTasks) * 100).toFixed(1) : 0;

        // Priority Chart
        const priorityCounts = {
            urgent: filteredTasks.filter(task => task.taskPriority === 'urgent').length,
            normal: filteredTasks.filter(task => task.taskPriority === 'normal').length,
            low: filteredTasks.filter(task => task.taskPriority === 'low').length,
        };

        // Workload Distribution
        const workloadData = filteredTasks.reduce((acc, task) => {
            task.assignedUsers.forEach(user => {
                const userId = user._id.toString();
                if (!acc[userId]) {
                    acc[userId] = { user, taskCount: 0 };
                }
                acc[userId].taskCount++;
            });
            return acc;
        }, {});

        const totalWorkloadTasks = filteredTasks.length;
        const workloadChartData = Object.values(workloadData).map(({ user, taskCount }) => ({
            user,
            percentage: ((taskCount / totalWorkloadTasks) * 100).toFixed(2),
            taskCount,
        }));

        // Aggregate and format Recent Activities
        const recentActivities = [];
        filteredTasks.forEach(task => {
            task.activityLogs.forEach(log => {
                recentActivities.push({
                    taskName: task.taskName,
                    taskId: task._id,
                    text: log.text,
                    type: log.type,
                    createdBy: log.createdBy || { username: 'Unknown User', profileImage: '/img/profileImage/Profile.jpeg' },
                    createdAt: log.createdAt ? formatDate(log.createdAt) : 'Invalid Date',
                });
            });
        });

        // Group by formatted date
        const activitiesGroupedByDate = recentActivities.reduce((acc, activity) => {
            const date = activity.createdAt !== 'Invalid Date'
                ? activity.createdAt.split(' ')[0] 
                : 'Invalid Date';
            if (!acc[date]) acc[date] = [];
            acc[date].push(activity);
            return acc;
        }, {});

        // Render the Dashboard
        res.render('task/task-dashboard', {
            spaces: space,
            tasks: filteredTasks,
            user: req.user,
            finishedTasksCount,
            updatedTasksCount,
            recentTasksCount,
            dueNextSevenDaysCount,
            statusCounts,
            statusPercentages,
            finishedPercentage,
            priorityCounts,
            workloadChartData,
            recentActivities: activitiesGroupedByDate,
            selectedPeriod,
            periodText,

            layout: '../views/layouts/task',
            currentPage: 'dashboard',
        });

    } catch (error) {
        console.error('Error in task_dashboard:', error);
        res.status(500).send('Internal Server Error');
    }
};

/// task board controller
exports.task_board = async (req, res) => {
    try {
        const spaceId = req.params.id;
        const userId = req.user.id;

        // Fetch the space
        const space = await Spaces.findOne({
            _id: spaceId,
            $or: [{ user: userId }, { collaborators: { $elemMatch: { user: userId } } }],
        })
            .populate('collaborators.user', 'username profileImage googleEmail ')
            .lean();

        if (!space) {
            return res.status(404).send("Space not found");
        }

        const spaceCollaborators = (space.collaborators || []).filter(c => c && c.user);
        const currentUserRole = spaceCollaborators.find(c => c.user._id.toString() === userId)?.role || 'Member';

        // Fetch tasks and populate required fields
        const tasks = await Task.find({ space: spaceId })
            .populate('assignedUsers', 'profileImage displayName')
            .lean();

        for (const task of tasks) {
            const subtasks = await SubTask.find({ task: task._id }).populate('assignee', 'username profileImage').lean();

            // Group subtasks by assignee and calculate completion percentage
            const assigneeProgress = subtasks.reduce((acc, subtask) => {
                const assigneeId = subtask.assignee?._id.toString();

                if (!acc[assigneeId]) {
                    acc[assigneeId] = {
                        assignee: subtask.assignee,
                        total: 0,
                        completed: 0,
                    };
                }

                acc[assigneeId].total++;
                if (subtask.subTask_status === 'เสร็จสิ้น') acc[assigneeId].completed++;

                return acc;
            }, {});

            // Add the calculated data to the task object
            task.assigneeProgress = Object.values(assigneeProgress).map((progress) => ({
                ...progress,
                percentage: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
            }));
        }

        // Organize tasks by status
        const statuses = await Status.find({ space: spaceId }).lean();

        // Log the fetched statuses for debugging
        console.log("Statuses:", statuses);

        const tasksByStatus = statuses.reduce((acc, status) => {
            acc[status.name] = tasks.filter(task => task.taskStatus === status.name);
            return acc;
        }, {});

        // Log tasks by status for debugging
        console.log("Tasks By Status:", tasksByStatus);

        // Prepare task counts for each status category
        const taskCounts = statuses.reduce((acc, status) => {
            acc[status.category] = tasksByStatus[status.name]?.length || 0;
            return acc;
        }, {});

        // Sort statuses by category
        const sortedStatuses = statuses.sort((a, b) => {
            const order = ['toDo', 'inProgress', 'fix', 'finished'];
            return order.indexOf(a.category) - order.indexOf(b.category);
        });

        // Calculate user workload
        const userWorkload = {};
        tasks.forEach(task => {
            task.assignedUsers.forEach(user => {
                const userId = user._id.toString();
                if (!userWorkload[userId]) {
                    userWorkload[userId] = {
                        name: user.displayName,
                        totalTasks: 0,
                        completedTasks: 0,
                    };
                }
                userWorkload[userId].totalTasks += 1; // Increment total tasks
                if (task.taskStatus === 'เสร็จสิ้น') {
                    userWorkload[userId].completedTasks += 1; // Increment completed tasks
                }
            });
        });

        // Calculate completion percentages for each user
        for (const userId in userWorkload) {
            const workload = userWorkload[userId];
            workload.percentage = workload.totalTasks > 0 ? Math.round((workload.completedTasks / workload.totalTasks) * 100) : 0;
        }

        res.render("task/task-board", {
            spaces: space,
            tasks,
            tasksByStatus,
            statuses: sortedStatuses,
            taskCounts,
            user: req.user,
            spaceCollaborators,
            currentUserRole,
            moment,
            userWorkload: JSON.stringify(userWorkload),
            currentPage: 'board',
            layout: "../views/layouts/task",
            priority: tasks.map(task => task.taskPriority), // Pass task priorities
        });
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};



// ลิสต์งาน (ยังไม่ได้ใช้)
exports.task_list = async (req, res) => {
    try {
        // Fetch the space with collaborators and owner
        const space = await Spaces.findOne({
            _id: req.params.id,
            $or: [
                { user: req.user._id },
                { collaborators: req.user._id }
            ]
        })
            .populate({
                path: 'user',
                select: 'displayName profileImage'
            })
            .lean();

        // Fetch the tasks associated with the space
        const tasks = await Task.find({ space: req.params.id })
            .populate({
                path: 'assignedUsers',
                select: 'displayName profileImage'
            })
            .lean();

        // Extract the parameters
        const { taskNames, taskDetail, taskStatuses, taskTypes, dueDate, createdAt, taskPriority, taskTag } = await extractTaskParameters(tasks);

        // Format the dates in Thai
        const thaiDueDate = dueDate.map(date => moment(date).format('DD MMMM'));
        const thaiCreatedAt = createdAt.map(date => moment(date).format('DD MMMM'));

        const currentUserRole = space.collaborators.find(collab => collab.user.toString() === req.user._id.toString())?.role || 'Member';

        // Render the task list page, passing all extracted data
        res.render("task/task-list", {
            spaces: space,
            spaceId: req.params.id,
            tasks: tasks,
            taskNames: taskNames,
            taskDetail: taskDetail,
            taskStatuses: taskStatuses,
            taskTypes: taskTypes,
            dueDate: thaiDueDate,
            createdAt: thaiCreatedAt,
            taskPriority: taskPriority,  // New addition
            taskTag: taskTag,  // New addition
            users: tasks.flatMap(task => task.assignedUsers),
            user: req.user.id,
            userName: req.user.firstName,
            userImage: req.user.profileImage,
            currentPage: 'task_list',
            layout: "../views/layouts/task",
            currentUserRole
        });
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

// Grantt Chart
exports.granttChart = async (req, res) => {
    try {
        // Fetch space details (owner or collaborator)
        const space = await Spaces.findOne({
            _id: req.params.id,
            $or: [
                { user: req.user._id }, // Space owner
                { collaborators: { $elemMatch: { user: req.user._id } } } // Collaborators
            ]
        })
            .populate('user', 'username profileImage') // Populate space owner
            .populate('collaborators.user', 'username profileImage email') // Populate collaborators
            .lean();

        if (!space) {
            return res.status(404).send("Space not found");
        }

        // Fetch tasks in the space
        const tasks = await Task.find({ space: req.params.id })
            .select("taskName createdAt dueDate assignedUsers")
            .populate("assignedUsers", "username")
            .lean();

        // Format tasks for Gantt chart
        const formattedTasks = tasks.map(task => ({
            id: task._id.toString(),
            name: task.taskName,
            start: task.createdAt.toISOString(),
            end: task.dueDate.toISOString(),
            assigned: task.assignedUsers.map(user => user.username),
        }));

        // Get the current user's role in the space
        const currentUserRole = space.collaborators.find(
            collab => collab.user._id.toString() === req.user._id.toString()
        )?.role || 'Member';

        // Render the view with data
        res.render("task/granttChart", {
            spaces: space,
            tasks: formattedTasks,
            spaceId: req.params.id,
            user: req.user,
            userImage: req.user.profileImage,
            userName: req.user.username,
            currentUserRole,
            currentPage: 'granttChart',
            layout: "../views/layouts/task",
        });

    } catch (error) {
        console.error('Error rendering Gantt chart page:', error);
        res.status(500).send("Internal Server Error");
    }
};
