const Chat = require('../models/Chat');
const Spaces = require('../models/Space');
const User = require('../models/User');
const mongoose = require('mongoose');
const multer = require('multer');
const Task = require('../models/Task');
const upload = multer({ dest: 'uploads/' });

const formatDate = (date) => {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('th-TH', options);
};

const formatTime = (date) => {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // ชั่วโมง 0 จะเป็น 12 AM
  minutes = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutes} ${ampm}`;
};

const isNewDay = (date1, date2) => {
  return (
    date1.getFullYear() !== date2.getFullYear() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getDate() !== date2.getDate()
  );
};

const formatMessageContent = (message) => {
  if (!message) return '';

  // แปลงลิงก์ mention งานให้เป็นลิงก์ที่คลิกได้
  return message.replace(/@<a href="\/task\/([^" ]+)\/detail"[^>]*>([^<]+)<\/a>/g,
    '<a href="/task/$1/detail" class="task-mention">@$2</a>');
};

exports.uploadFiles = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const userId = req.user.id;
    let message = req.body.message || '';
    const mentionedUsers = JSON.parse(req.body.mentionedUsers || '[]');

    message = formatMessageContent(message);

    // Process mentions
    message = message.replace(/@([^ ]+) \(user:([^)]+)\)/g,
      '@<a href="/user/$2">$1</a>');
    message = message.replace(/@([^ ]+) \(task:([^)]+)\)/g,
      '@<a href="/task/$2/detail">$1</a>');

    if (!message.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: "ต้องมีข้อความหรือไฟล์แนบอย่างน้อยหนึ่งอย่าง" });
    }

    // Process file uploads
    const fileData = req.files ? req.files.map(file => ({
      url: `/uploads/chat_files/${file.filename}`,
      originalname: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      mimetype: file.mimetype,
      size: file.size,
      filename: file.filename
    })) : [];

    // Create new message
    const newMessage = new Chat({
      spaceId,
      userId,
      message: message.trim() || undefined,
      files: fileData.length > 0 ? fileData : undefined,
      readBy: [], // Mark as read by sender
      mentionedUsers,
      type: 'group'
    });

    await newMessage.save();

    // ในส่วนของการส่งข้อความ
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('readBy', 'firstName lastName')
      .lean();

    // ตรวจสอบและแปลงข้อมูลไฟล์ให้ถูกต้องก่อนส่ง
    if (populatedMessage.files && populatedMessage.files.length > 0) {
      populatedMessage.files = populatedMessage.files.map(file => ({
        url: file.url,
        originalname: file.originalname,
        mimetype: file.mimetype
      }));
    }

    const io = req.app.get('io');
    io.to(`space_${spaceId}`).emit('new group message', populatedMessage);
    io.emit('update last group message', {
      spaceId,
      userId: populatedMessage.userId,
      message: populatedMessage.message,
      files: populatedMessage.files, // ตรวจสอบว่าส่งข้อมูลไฟล์แนบไปด้วย
      createdAt: populatedMessage.createdAt
    });

    // Notify mentioned users
    if (mentionedUsers.length > 0) {
      mentionedUsers.forEach(userId => {
        io.to(`user_${userId}`).emit('new mention', {
          mentionedBy: `${req.user.firstName} ${req.user.lastName}`,
          projectName: 'Project Name',
          message: message,
          link: `/space/item/${spaceId}/chat`
        });
      });
    }

    res.status(200).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("Error uploading files:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// เรนเดอร์หน้าแชท
exports.renderChatPage = async (req, res) => {
  try {
    const spaceId = req.params.id;

    // Get space, messages, and tasks in parallel
    const [space, messages, tasks] = await Promise.all([
      Spaces.findById(spaceId).populate('collaborators.user', 'firstName lastName profileImage').lean(),
      Chat.find({ spaceId, type: 'group' })
        .populate('userId', 'firstName lastName profileImage')
        .populate('readBy', 'firstName lastName')
        .sort({ createdAt: 'asc' })
        .lean(),
      Task.find({ project: spaceId }).select('_id taskName').lean()
    ]);

    if (!space) {
      return res.status(404).send("Space not found");
    }

    // Get last group message
    const lastGroupMessage = await Chat.findOne({ spaceId, type: 'group' })
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    // Process collaborators with their last messages
    const collaboratorsWithLastMessage = await Promise.all(
      space.collaborators.map(async (collab) => {
        if (collab.user && collab.user._id.toString() !== req.user._id.toString()) {
          const lastMessage = await Chat.findOne({
            $or: [
              { userId: collab.user._id, targetUserId: req.user._id },
              { userId: req.user._id, targetUserId: collab.user._id }
            ],
            type: 'private'
          })
            .populate('userId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .lean();

          return {
            ...collab,
            lastMessage: lastMessage ? lastMessage.message : null,
            lastMessageTime: lastMessage ? lastMessage.createdAt : null,
            lastMessageSender: lastMessage ? lastMessage.userId : null
          };
        }
        return collab;
      })
    );

    res.render('task/task-chat', {
      spaces: { ...space, collaborators: collaboratorsWithLastMessage },
      messages,
      lastGroupMessage,
      tasks,
      user: req.user,
      layout: '../views/layouts/task',
      currentPage: 'task_chat',
      currentChatUserId: null,
      formatMessageContent,
      formatDate,
      formatTime,
      isNewDay,
    });

  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

// ส่งข้อความ
exports.postMessage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    let message = req.body.message;
    const mentionedUserIds = req.body.mentionedUsers || [];
    const userId = req.user.id;
    const type = req.body.type || 'group';

    message = formatMessageContent(message);

    if (!message || !userId || !spaceId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const newMessage = new Chat({
      spaceId,
      userId,
      message: message.trim(),
      readBy: [userId],
      mentionedUsers: mentionedUserIds,
      type
    });

    await newMessage.save();

    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('readBy', 'firstName lastName')
      .lean();

    const io = req.app.get('io');

    if (type === 'group') {
      io.to(`space_${spaceId}`).emit('new group message', populatedMessage);
      io.emit('update last group message', {
        spaceId,
        userId: populatedMessage.userId,
        message: populatedMessage.message,
        files: populatedMessage.files, // ตรวจสอบว่าส่งข้อมูลไฟล์แนบไปด้วย
        createdAt: populatedMessage.createdAt
      });

      // อัปเดตจำนวนข้อความที่ยังไม่ได้อ่าน
      io.emit('update unread count', {
        spaceId,
        senderId: userId,
        type: 'group'
      });
    }

    res.status(200).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.log("Error posting message:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getUnreadMentionsCount = async (req, res) => {
  try {
    const userId = req.user.id;

    // ดึงข้อมูลการแจ้งเตือนที่ยังไม่ได้อ่าน
    const unreadMentions = await Chat.find({
      mentionedUsers: userId,
      readBy: { $ne: userId },
    })
      .populate('userId', 'firstName lastName') // ดึงข้อมูลผู้ส่งข้อความ
      .lean();

    console.log('Unread Mentions:', unreadMentions); // Log ข้อมูล

    // ส่งข้อมูลกลับไปยัง Frontend
    return res.status(200).json({
      success: true,
      unreadMentions: unreadMentions.map(mention => ({
        mentionedBy: `${mention.userId.firstName} ${mention.userId.lastName}`,
        projectName: 'Project Name', // ควรดึงข้อมูลจากฐานข้อมูล
        message: mention.message,
        link: `/space/item/${mention.spaceId}/chat`
      }))
    });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือนที่ยังไม่ได้อ่าน:", error);
    return res.status(500).json({ success: false, error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};

exports.getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const spaces = await Spaces.find({ 'collaborators.user': userId }).lean();

    const unreadCounts = await Promise.all(spaces.map(async (space) => {
      const unreadMessages = await Chat.countDocuments({
        spaceId: space._id,
        readBy: { $nin: [userId] }, // นับเฉพาะข้อความที่ผู้ใช้ยังไม่ได้อ่าน
        userId: { $ne: userId } // ไม่นับข้อความที่ผู้ใช้ส่งเอง
      });
      return {
        spaceId: space._id,
        projectName: space.projectName,
        unreadCount: unreadMessages
      };
    }));

    res.status(200).json({ success: true, unreadCounts });
  } catch (error) {
    console.error('Error fetching unread message counts:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// อัปเดตสถานะการอ่านข้อความ
exports.markAsRead = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;
  const spaceId = req.params.spaceId;

  try {
    const chat = await Chat.findById(messageId);
    if (!chat) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    // ตรวจสอบว่าผู้ใช้ยังอยู่ในหน้าแชทนี้หรือไม่
    const usersInSpaceChat = req.app.get('usersInChat').get(spaceId) || new Set();

    if (usersInSpaceChat.has(userId)) {
      // ตรวจสอบว่าผู้ใช้ไม่ใช่ผู้ส่งข้อความ และยังไม่ได้อ่านข้อความนี้
      if (chat.userId.toString() !== userId.toString() && !chat.readBy.includes(userId)) {
        chat.readBy.push(userId);
        await chat.save();

        // แจ้ง client ว่าข้อความถูกอ่าน
        req.app.get('io').emit('message read update', {
          messageId: chat._id.toString(),
          readByCount: chat.readBy.filter(id => id.toString() !== chat.userId.toString()).length,
        });
      }
      await Chat.updateMany(
        {
          spaceId,
          type: 'group',
          readBy: { $ne: userId },
          userId: { $ne: userId } // ไม่นับข้อความที่ผู้ใช้ส่งเอง
        },
        { $push: { readBy: userId } }
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ใน chatController.js
exports.getMentionPeople = async (req, res) => {
  try {
    const spaceId = req.params.spaceId;
    const space = await Spaces.findById(spaceId)
      .populate('collaborators.user', 'firstName lastName profileImage')
      .lean();

    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    // กรองเฉพาะ collaborators ที่ไม่ใช่ผู้ใช้ปัจจุบัน
    const people = space.collaborators
      .filter(collab => collab.user && collab.user._id.toString() !== req.user._id.toString())
      .map(collab => collab.user);

    res.json({ success: true, people });
  } catch (error) {
    console.error('Error getting mention people:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// ค้นหาผู้ใช้ตามชื่อ
exports.searchUsers = async (req, res) => {
  try {
    const { spaceId } = req.params;
    const space = await Spaces.findById(spaceId)
      .populate('collaborators.user', 'firstName lastName profileImage')
      .lean();

    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    // ดึงข้อมูลผู้ใช้ทั้งหมดจาก collaborators
    const users = space.collaborators
      .map(collab => collab.user)
      .filter(user => user && user._id.toString() !== req.user._id.toString());

    res.json({
      success: true,
      users: users.map(user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage
      }))
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

exports.getMentionTasks = async (req, res) => {
  try {
    const spaceId = req.params.spaceId;
    const tasks = await Task.find({ project: spaceId })
      .select('_id taskName')
      .lean();

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting mention tasks:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

exports.getTasksForMention = async (req, res) => {
  try {
    const spaceId = req.params.spaceId;
    const tasks = await Task.find({ project: spaceId })
      .select('_id taskName')
      .lean();

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting tasks for mention:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

exports.markAllAsRead = async (req, res) => {
  const { spaceId } = req.params;
  const { userId } = req.body;

  try {
    // อัปเดตข้อความทั้งหมดใน Space ที่ยังไม่ได้อ่าน
    await Chat.updateMany(
      { spaceId, readBy: { $ne: userId } }, // ค้นหาข้อความที่ผู้ใช้ยังไม่ได้อ่าน
      { $push: { readBy: userId } } // เพิ่ม userId เข้าไปใน readBy
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

exports.markGroupMessagesAsRead = async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { userId } = req.body;

    await Chat.updateMany(
      {
        spaceId,
        type: 'group',
        readBy: { $ne: userId },
        userId: { $ne: userId } // ไม่นับข้อความที่ผู้ใช้ส่งเอง
      },
      { $push: { readBy: userId } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking group messages as read:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// แสดงหน้าแชทส่วนตัว
exports.renderPrivateChatPage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user.id;

    // ดึงข้อมูล space และ populate collaborators
    const space = await Spaces.findById(spaceId)
      .populate({
        path: 'collaborators.user',
        select: 'firstName lastName profileImage'
      })
      .lean();

    // ดึงข้อมูล targetUser และแน่ใจว่าได้ profileImage
    const targetUser = await User.findById(targetUserId)
      .select('firstName lastName profileImage')
      .lean();

    if (!space || !targetUser) {
      return res.status(404).send("ไม่พบ Space หรือผู้ใช้เป้าหมาย");
    }

    // ดึงข้อมูล lastMessage สำหรับแต่ละ collaborator (รวมข้อมูลไฟล์แนบ)
    const collaboratorsWithLastMessage = await Promise.all(
      space.collaborators.map(async (collab) => {
        if (collab.user && collab.user._id.toString() !== userId.toString()) {
          const lastMessage = await Chat.findOne({
            $or: [
              { userId: collab.user._id, targetUserId: req.user._id },
              { userId: req.user._id, targetUserId: collab.user._id }
            ],
            type: 'private'
          })
            .populate('userId', 'firstName lastName')
            .sort({ createdAt: -1 })
            .lean();

          return {
            ...collab,
            lastMessage: lastMessage ? (lastMessage.files && lastMessage.files.length > 0 ? 'แนบไฟล์' : lastMessage.message) : null,
            lastMessageTime: lastMessage ? lastMessage.createdAt : null,
            lastMessageSender: lastMessage ? lastMessage.userId : null,
            lastMessageFiles: lastMessage ? lastMessage.files : null // เพิ่มข้อมูลไฟล์แนบ
          };
        }
        return collab;
      })
    );

    // ดึงข้อความส่วนตัวระหว่างผู้ใช้ (รวมข้อมูลไฟล์แนบ)
    const messages = await Chat.find({
      spaceId,
      $or: [
        { userId, targetUserId },
        { userId: targetUserId, targetUserId: userId }
      ],
      type: 'private',
    })
    .populate('userId', 'firstName lastName profileImage')
    .populate('targetUserId', 'firstName lastName profileImage')
    .populate('readBy', '_id') // ต้อง populate readBy ด้วย
    .sort({ createdAt: 'asc' })
    .lean();

    // ดึงข้อความล่าสุดของแชทกลุ่ม (รวมข้อมูลไฟล์แนบ)
    const lastGroupMessage = await Chat.findOne({ spaceId, type: 'group' })
      .populate('userId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.render('task/task-chat-private', {
      spaces: { ...space, collaborators: collaboratorsWithLastMessage },
      messages,
      user: req.user,
      targetUser,
      lastGroupMessage,
      layout: '../views/layouts/task',
      currentPage: 'task_chat_private',
      currentChatUserId: targetUserId,
      formatMessageContent,
      formatDate,
      formatTime,
      isNewDay,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์");
  }
};

exports.uploadPrivateFiles = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user.id;
    let message = req.body.message || '';
    const mentionedUsers = JSON.parse(req.body.mentionedUsers || '[]');

    message = formatMessageContent(message);

    // Process mentions
    message = message.replace(/@([^ ]+) \(user:([^)]+)\)/g,
      '@<a href="/user/$2">$1</a>');
    message = message.replace(/@([^ ]+) \(task:([^)]+)\)/g,
      '@<a href="/task/$2/detail">$1</a>');

    // ตรวจสอบว่ามีข้อความหรือไฟล์แนบอย่างน้อยหนึ่งอย่าง
    if (!message.trim() && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: "ต้องมีข้อความหรือไฟล์แนบอย่างน้อยหนึ่งอย่าง" });
    }

    // เตรียมข้อมูลไฟล์
    const fileData = req.files ? req.files.map(file => ({
      url: `/uploads/chat_files/${file.filename}`,
      originalname: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      mimetype: file.mimetype,
      size: file.size,
      filename: file.filename
    })) : [];

    // สร้างข้อความใหม่
    const newMessage = new Chat({
      spaceId,
      userId,
      targetUserId,
      message: message.trim() || undefined,
      files: fileData.length > 0 ? fileData : undefined,
      readBy: [],
      mentionedUsers,
      type: 'private'
    });

    await newMessage.save();

    // ดึงข้อมูลข้อความพร้อม populate
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('targetUserId', 'firstName lastName profileImage')
      .populate('readBy', 'firstName lastName')
      .lean();

    // ส่งข้อความผ่าน Socket.io
    const io = req.app.get('io');
    io.to(`private_${userId}_${targetUserId}`).emit('private message', populatedMessage);
    io.to(`private_${targetUserId}_${userId}`).emit('private message', populatedMessage);

    // อัปเดตข้อความล่าสุด (รวมข้อมูลไฟล์แนบ)
    io.emit('update last private message', {
      userId: populatedMessage.userId ? {
        _id: populatedMessage.userId._id.toString(),
        firstName: populatedMessage.userId.firstName,
        lastName: populatedMessage.userId.lastName
      } : null,
      targetUserId: populatedMessage.targetUserId ? {
        _id: populatedMessage.targetUserId._id.toString(),
        firstName: populatedMessage.targetUserId.firstName,
        lastName: populatedMessage.targetUserId.lastName
      } : null,
      message: populatedMessage.files && populatedMessage.files.length > 0 ? 'แนบไฟล์' : populatedMessage.message,
      files: populatedMessage.files,
      createdAt: populatedMessage.createdAt
    });

    res.status(200).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการอัปโหลดไฟล์ส่วนตัว:", error);
    res.status(500).json({ error: error.message || "ข้อผิดพลาดภายในเซิร์ฟเวอร์" });
  }
};

// ส่งข้อความส่วนตัว
exports.sendPrivateMessage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user.id;
    let message = req.body.message;
    const mentionedUserIds = req.body.mentionedUsers || [];
    const files = req.body.files || []; // เพิ่มการรองรับไฟล์แนบ

    if (!message && (!files || files.length === 0)) {
      return res.status(400).json({ success: false, error: "ต้องมีข้อความหรือไฟล์แนบอย่างน้อยหนึ่งอย่าง" });
    }

    message = formatMessageContent(message);

    // Process mentions
    message = message.replace(/@([^ ]+) \(user:([^)]+)\)/g,
      '@<a href="/user/$2">$1</a>');
    message = message.replace(/@([^ ]+) \(task:([^)]+)\)/g,
      '@<a href="/task/$2/detail">$1</a>');

    const newMessage = new Chat({
      spaceId,
      userId,
      targetUserId,
      message: message ? message.trim() : undefined,
      files: files.length > 0 ? files : undefined,
      type: 'private',
      readBy: [],
      mentionedUsers: mentionedUserIds
    });

    await newMessage.save();

    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('targetUserId', 'firstName lastName profileImage')
      .lean();

    // ส่งผ่าน Socket.io
    const io = req.app.get('io');
    io.to(`private_${userId}_${targetUserId}`).emit('private message', populatedMessage);
    io.to(`private_${targetUserId}_${userId}`).emit('private message', populatedMessage);

    // ส่งอีเวนต์อัปเดตจำนวนข้อความที่ยังไม่อ่าน (รวมข้อมูลไฟล์แนบ)
    io.emit('update unread count', {
      spaceId,
      senderId: userId,
      targetUserId,
      message: populatedMessage.files && populatedMessage.files.length > 0 ? 'แนบไฟล์' : populatedMessage.message,
      files: populatedMessage.files
    });

    // Notify mentioned users
    if (mentionedUserIds.length > 0) {
      mentionedUserIds.forEach(mentionedUserId => {
        io.to(`user_${mentionedUserId}`).emit('new mention', {
          mentionedBy: `${req.user.firstName} ${req.user.lastName}`,
          projectName: 'Project Name',
          message: populatedMessage.files && populatedMessage.files.length > 0 ? 'แนบไฟล์' : populatedMessage.message,
          link: `/space/item/${spaceId}/chat/private/${userId}`
        });
      });
    }

    res.status(200).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.error("Error sending private message:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// อัปเดตสถานะการอ่านข้อความส่วนตัว
exports.markPrivateMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const targetUserId = req.params.targetUserId;

    const message = await Chat.findById(messageId)
      .populate('readBy', '_id')
      .populate('userId', '_id');

    if (!message) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    // ตรวจสอบว่ายังไม่ได้อ่านและไม่ใช่ผู้ส่ง
    if (!message.readBy.some(readUser => 
      readUser._id.equals(userId)) && 
      !message.userId._id.equals(userId)
    ) {
      await Chat.findByIdAndUpdate(messageId, {
        $addToSet: { readBy: userId }
      });

      // ดึงข้อมูลใหม่หลังจากอัพเดต
      const updatedMessage = await Chat.findById(messageId)
        .populate('readBy', '_id')
        .lean();

      // นับเฉพาะผู้อ่านที่ไม่ใช่ผู้ส่ง
      const readCount = updatedMessage.readBy.filter(readUser => 
        readUser._id && !readUser._id.equals(updatedMessage.userId._id)
      ).length;

      // ส่งอัพเดตผ่าน Socket.io
      const io = req.app.get('io');
      io.to(`private_${userId}_${targetUserId}`)
        .to(`private_${targetUserId}_${userId}`)
        .emit('private message read update', {
          messageId: message._id.toString(),
          readBy: updatedMessage.readBy.map(r => r._id.toString()),
          readByCount: readCount
        });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// ดึงจำนวนข้อความที่ยังไม่อ่านในแชทกลุ่ม
exports.getUnreadGroupMessageCount = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const userId = req.user._id;

    const unreadCount = await Chat.countDocuments({
      spaceId,
      type: 'group',
      readBy: { $nin: [userId] },
      userId: { $ne: userId }
    });

    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error fetching unread group message count:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

// ดึงจำนวนข้อความที่ยังไม่อ่านในแชทส่วนตัว
exports.getUnreadPrivateMessageCount = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user._id;

    const unreadCount = await Chat.countDocuments({
      spaceId,
      $or: [
        { userId: targetUserId, targetUserId: userId },
        { userId: userId, targetUserId: targetUserId }
      ],
      type: 'private',
      readBy: { $nin: [userId] },
      userId: { $ne: userId }
    });

    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    console.error('Error fetching unread private message count:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};

exports.markPrivateMessagesAsRead = async (req, res) => {
  try {
    const { spaceId, targetUserId } = req.params;
    const { userId } = req.body;

    // อัปเดตข้อความทั้งหมดที่ยังไม่ได้อ่าน
    const result = await Chat.updateMany(
      {
        spaceId,
        userId: targetUserId,
        targetUserId: userId,
        readBy: { $ne: userId },
        type: 'private'
      },
      { $addToSet: { readBy: userId } }
    );

    // ดึงข้อความที่ถูกอัปเดต
    const updatedMessages = await Chat.find({
      spaceId,
      userId: targetUserId,
      targetUserId: userId,
      type: 'private'
    })
    .populate('readBy', '_id')
    .populate('userId', '_id');

    // ส่งอัพเดตไปยังผู้ใช้ทั้งสองฝ่าย
    const io = req.app.get('io');
    updatedMessages.forEach(message => {

      const readCount = message.readBy.filter(readUser => 
        readUser._id && !readUser._id.equals(message.userId._id)
      ).length;
      
      io.to(`private_${targetUserId}_${userId}`).emit('private message read update', {
        messageId: message._id.toString(),
        readByCount: readCount
      });
      
      io.to(`private_${userId}_${targetUserId}`).emit('private message read update', {
        messageId: message._id.toString(),
        readByCount: readCount
      });
    });

    res.status(200).json({ 
      success: true,
      updatedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error marking private messages as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error' 
    });
  }
};