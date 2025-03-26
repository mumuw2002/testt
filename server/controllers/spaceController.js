//Space Controller
const Spaces = require('../models/Space');
const Space = require('../models/Space');
const User = require('../models/User');
const Status = require('../models/Status');
const Notification = require('../models/Noti');
const mongoose = require("mongoose");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const Task = require('../models/Task'); 
const fs = require('fs');
moment.locale('th');
const logUserActivity = require('../utils/activityLogger');
const logFeatureUsage = require('../utils/featureLogger');

exports.SpaceDashboard = async (req, res) => {
  try {
    const userId = mongoose.Types.ObjectId(req.user.id);

    // Fetch spaces
    const spaces = await Spaces.find({
      $or: [
        { user: userId },
        { collaborators: { $elemMatch: { user: userId } } }
      ],
      deleted: false
    })
      .populate('user', 'username profileImage')
      .populate('collaborators.user', 'username profileImage')
      .lean();

      // Ensure each space has a valid project cover
      for (const space of spaces) {
        if (!space.projectCover || typeof space.projectCover !== "string") {
          space.projectCover = '/public/spacePictures/defaultBackground.jpg';
        } else {
          const picturePath = path.join(__dirname, '../..', space.projectCover);
          if (!fs.existsSync(picturePath)) {
            space.projectCover = '/public/spacePictures/defaultBackground.jpg';
          }
        }

        const taskCount = await Task.countDocuments({ space: space._id, deleteAt: null });
        space.taskCount = taskCount;
      }

      // Fetch notifications with space populated
      const notifications = await Notification.find({ user: userId, status: 'unread' })
        .populate('user', 'username profileImage')
        .populate('space', 'projectName')  
        .populate('leader', 'profileImage') // Populate the leader field
        .sort({ createdAt: -1 }) // Order by most recent
        .lean();
      const unreadCount = notifications.length;
    
      res.render("space/space-dashboard", {
        spaces,
        user: req.user,
        notifications,
        unreadCount,
        layout: "../views/layouts/Space"
      });
    } catch (error) {
      console.error("Error fetching spaces:", error);
      res.status(500).send("Internal Server Error");
    }
  };

// create space controller
exports.createSpace = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const userId = mongoose.Types.ObjectId(req.user.id);
      const spaces = await Spaces.find({
        $or: [
          { user: userId },
          { collaborators: { $elemMatch: { user: userId } } }
        ],
        deleted: false
      })
        .populate('user', 'username profileImage')
        .populate('collaborators.user', 'username profileImage')
        .lean();
      
      const notifications = await Notification.find({ user: userId, status: 'unread' })
        .populate('user', 'username profileImage')
        .populate('space', 'projectName')
        .populate('leader', 'profileImage')
        .sort({ createdAt: -1 })
        .lean();
      const unreadCount = notifications.length;
      const errorMessage = req.flash('error'); // Capture the error flash message here

      res.render("space/createProject", {
        spaces,
        user: req.user,
        layout: "../views/layouts/Space",
        notifications,
        unreadCount,
        errorMessage: errorMessage.length > 0 ? errorMessage[0] : null, // Pass the message to the view
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal Server Error");
    }
  }
  else if (req.method === 'POST') {
    try {
      const { projectName, projectDetail, members, dueDate } = req.body;
      
      const userId = mongoose.Types.ObjectId(req.user.id);
      const existingProject = await Spaces.findOne({
        projectName: projectName.trim(),
        $or: [
          { user: userId },
          { collaborators: { $elemMatch: { user: userId } } }
        ],
        deleted: false,
      });
      if (existingProject) {
        req.flash("error", "A project with this name already exists.");
        return res.redirect("/createSpace");
      }

      let parsedDueDate = null;
      if (dueDate) {
        const tempDate = new Date(dueDate);
        if (!isNaN(tempDate.getTime())) {
          parsedDueDate = tempDate;
        }
      }

      const newSpace = new Spaces({
        projectName,
        projectDetail: projectDetail?.trim() || "",
        projectDueDate: parsedDueDate,
        collaborators: [
          {
            user: req.user.id,
            role: "owner", 
          },
        ],
        projectCover: req.file
          ? `/public/projectCover/${req.file.filename}`
          : "/public/projectCover/defultBackground.jpg",
      });

      // Add members to the collaborators list and create notifications
      if (members) {
        const memberList = JSON.parse(members);
        for (const member of memberList) {
          const isMember = newSpace.collaborators.some(
            (collab) => collab.user.toString() === member.id
          );
          if (!isMember) {
            newSpace.collaborators.push({
              user: member.id,
              role: "member",
            });

            // Create notification for each added member
            const notificationMessage = `${req.user.username} ได้เพิ่มคุณเข้าโปรเจกต์ ${projectName} แล้ว`;
            const notification = new Notification({
              user: member.id,
              space: newSpace._id,
              leader: req.user.id,
              type: 'memberAdded',
              message: notificationMessage,
            });

            await notification.save();
          }
        }
      }
      await newSpace.save();
      
      await logUserActivity(req.user._id, 'สร้างโปรเจกต์');
      await logFeatureUsage('สร้างโปรเจกต์');

      // Add default statuses
      const defaultStatuses = [
        { name: "ยังไม่ทำ", category: "toDo", space: newSpace._id },
        { name: "กำลังทำ", category: "inProgress", space: newSpace._id },
        { name: "แก้ไข", category: "fix", space: newSpace._id },
        { name: "เสร็จสิ้น", category: "finished", space: newSpace._id },
      ];
      await Status.insertMany(defaultStatuses);

      res.redirect("/Space");
    } catch (error) {
      req.flash('error', 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรเจกต์');
      res.redirect('/createProject');
    }
  }
};

// Add the route to check if the project name already exists
exports.checkExistingProject = async (req, res) => {
  try {
    const { projectName } = req.body;
    const userId = mongoose.Types.ObjectId(req.user.id);
    
    // Check for existing project with the same name
    const existingProject = await Spaces.findOne({
      projectName: projectName.trim(),
      $or: [
        { user: userId },
        { collaborators: { $elemMatch: { user: userId } } }
      ],
      deleted: false,
    });

    if (existingProject) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

exports.searchMembers = async (req, res) => {
  try {
    const query = req.query.q;
    const currentUserId = req.user.id;
    if (!query) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { googleEmail: { $regex: query, $options: 'i' } },
        { userid: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: currentUserId }
    })
      .limit(10)
      .select('username googleEmail userid profileImage');

      await logFeatureUsage('ค้นหาสมาชิก');
      await logUserActivity(req.user._id, 'ค้นหาสมาชิก');

    res.json(users);
  } catch (error) {
    console.error('Error searching members:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteSpace = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const userId = req.user.id;

    const space = await Spaces.findOne({
      _id: spaceId,
      $or: [{ user: userId }, { collaborators: { $elemMatch: { user: userId } } }],
    });

    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    // Soft delete by setting 'deleted' to true
    space.deleted = true;
    await space.save();

    await logUserActivity(req.user._id, 'ลบโปรเจกต์');
    await logFeatureUsage('ลบโปรเจกต์');
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Show subjects that can Recover
exports.ShowRecover = async (req, res) => {
  try {
    const spaces = await Spaces.aggregate([
      { $match: { user: mongoose.Types.ObjectId(req.user.id), deleted: true } },
      { $project: { SpaceName: 1, SpaceDescription: 1 } },
      {
        $lookup: {
          from: "tasks",
          localField: "_id",
          foreignField: "spaces",
          as: "tasks",
        },
      },
      {
        $addFields: {
          taskCount: { $size: "$tasks" },
        },
      },
    ]).exec();

    res.render("Space/space-recover", {
      spaces: spaces,
      userName: req.user.username,
      usernameId: req.user.userid,
      userImage: req.user.profileImage,
      layout: "../views/layouts/Space",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

// Recover space
exports.recoverSpace = async (req, res) => {
  try {
    const space = await Spaces.findByIdAndUpdate(
      req.params.id,
      { deleted: false },
      { new: true }
    );

    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    await logUserActivity(req.user._id, 'กู้คืนโปรเจกต์');
    await logFeatureUsage('กู้คืนโปรเจกต์');

    res.redirect('/Space');
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

const storage = multer.diskStorage({
  destination: "./public/spacePictures/",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const spaceStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(
      null,
      "/Users/p/Desktop/10:04_TaskP/public/spacePictures"
    );
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (extName && mimeType) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed!'));
  }
}).single('SpacePicture');

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|bmp|svg/; // เพิ่มประเภทที่อนุญาต
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น!");
  }
}

module.exports.edit_Update_SpacePicture = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      res.send(
        '<script>alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' +
        err +
        '"); window.location="/Space";</script>'
      );
    } else {
      if (req.file == undefined) {
        // กรณีไม่ได้เลือกไฟล์
        res.send(
          '<script>alert("ไม่ได้เลือกไฟล์! กรุณาเลือกไฟล์รูปภาพ"); window.location="/Space";</script>'
        );
      } else {
        try {
          // ค้นหา space จาก id และอัปเดตรูปภาพ
          const space = await Space.findById(req.params.id);
          space.SpacePicture = "/spaceictures/" + req.file.filename;
          await space.save();

          // หลังจากบันทึกเสร็จสิ้น
          res.send(
            '<script>alert("อัปโหลดรูปภาพสำเร็จ"); window.location="/Space";</script>'
          );
        } catch (error) {
          console.log(error);
          res.send(
            '<script>alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' +
            error.message +
            '"); window.location="/Space";</script>'
          );
        }
      }
    }
  });
};

module.exports.edit_Update_SpaceName = async (req, res) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space) {
      return res.status(404).send('<script>alert("ไม่พบพื้นที่งาน!"); window.location="/Space";</script>');
    }

    space.SpaceName = req.body.SpaceName;
    await space.save();

    await logUserActivity(req.user._id, 'แก้ไขชื่อโปรเจค');
    await logFeatureUsage('แก้ไขชื่อโปรเจค');

    res.redirect('/Space'); // เปลี่ยนเป็น redirect เพื่อโหลดใหม่โดยไม่มีแจ้งเตือน
  } catch (error) {
    console.log(error);
    res.send('<script>alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message + '"); window.location="/Space";</script>');
  }
};

exports.addStatus = async (req, res) => {
  try {
      const { statusName, category, spaceId } = req.body;

      if (!statusName || !category || !spaceId) {
          return res.status(400).send("All fields are required.");
      }

      const space = await Space.findById(spaceId);
      if (!space) {
          return res.status(404).send("Space not found.");
      }

      const newStatus = new Status({
          name: statusName,
          category: category,
          space: spaceId
      });

      await newStatus.save();

      res.redirect(`/Space/item/${spaceId}/task_board`);
  } catch (error) {
      console.error('Error adding status:', error);
      res.status(500).send("Internal Server Error");
  }
};

exports.getSpaceStatuses = async (req, res) => {
  try {
      const { spaceId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(spaceId)) {
          return res.status(400).send("Invalid space ID.");
      }

      const statuses = await Status.find({ space: spaceId }).sort({ name: 1 });
      res.status(200).json(statuses);
  } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
  }
};

