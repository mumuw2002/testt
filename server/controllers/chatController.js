const Chat = require('../models/Chat');
const Spaces = require('../models/Space');
const User = require('../models/User');
const mongoose = require('mongoose');

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


// เรนเดอร์หน้าแชท
exports.renderChatPage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const space = await Spaces.findById(spaceId).populate('collaborators.user', 'firstName lastName profileImage').lean();

    if (!space) {
      return res.status(404).send("Space not found");
    }

    // ดึงข้อความล่าสุดสำหรับแต่ละผู้ใช้
    const collaboratorsWithLastMessage = await Promise.all(space.collaborators.map(async (collab) => {
      if (collab.user && collab.user._id.toString() !== req.user._id.toString()) {
        const lastMessage = await Chat.findOne({
          $or: [
            { userId: collab.user._id, targetUserId: req.user._id },
            { userId: req.user._id, targetUserId: collab.user._id }
          ],
          type: 'private'
        })
          .sort({ createdAt: -1 })
          .lean();

        return {
          ...collab,
          lastMessage: lastMessage ? lastMessage.message : null,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null
        };
      }
      return collab;
    }));

    // ดึงข้อความล่าสุดของแชทกลุ่ม
    const lastGroupMessage = await Chat.findOne({ spaceId, type: 'group' })
      .sort({ createdAt: -1 })
      .lean();

    // ดึงข้อความทั้งหมดของแชทกลุ่ม
    const messages = await Chat.find({ spaceId, type: 'group' })
      .populate('userId', 'firstName lastName profileImage')
      .populate('readBy', 'firstName lastName')
      .sort({ createdAt: 'asc' })
      .lean();

    res.render('task/task-chat', {
      spaces: { ...space, collaborators: collaboratorsWithLastMessage },
      messages,
      lastGroupMessage, // ส่งข้อความล่าสุดของแชทกลุ่มไปยังหน้า EJS
      user: req.user,
      layout: '../views/layouts/task',
      currentPage: 'task_chat',
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
    const message = req.body.message;
    const mentionedUserIds = req.body.mentionedUsers || [];
    const userId = req.user.id;
    const type = req.body.type || 'group'; // กำหนดประเภทข้อความ

    if (!message || !userId || !spaceId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const space = await Spaces.findById(spaceId);
    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    const usersInChat = req.app.get('usersInChat');

    const usersInSpaceChat = usersInChat.get(spaceId) || new Set();

    // ตรวจสอบว่าไม่เพิ่มผู้ส่งข้อความลงใน readBy
    const readBy = Array.from(usersInSpaceChat).filter(id => id.toString() !== userId.toString());

    const newMessage = new Chat({
      spaceId,
      userId,
      message,
      readBy: readBy,
      mentionedUsers: mentionedUserIds,
      type: type // กำหนดประเภทข้อความ
    });

    await newMessage.save();

    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('readBy', 'firstName lastName')
      .populate('mentionedUsers', 'firstName lastName profileImage')
      .lean();

    const io = req.app.get('io');

    if (type === 'group') {
      io.emit('chat message', populatedMessage);
      io.emit('update last group message', {
        message: populatedMessage.message,
        createdAt: populatedMessage.createdAt,
        spaceId: populatedMessage.spaceId
      });
    } else if (type === 'private') {
      io.to(`private_${userId}_${populatedMessage.targetUserId}`).emit('private message', populatedMessage);
      io.to(`private_${populatedMessage.targetUserId}_${userId}`).emit('private message', populatedMessage);
      
      // ส่งข้อมูลที่ครบถ้วนสำหรับการอัปเดต
      io.emit('update last private message', {
        message: populatedMessage.message,
        createdAt: populatedMessage.createdAt,
        userId: {
          _id: populatedMessage.userId._id.toString(),
          firstName: populatedMessage.userId.firstName,
          lastName: populatedMessage.userId.lastName
        },
        targetUserId: {
          _id: populatedMessage.targetUserId._id.toString(),
          firstName: populatedMessage.targetUserId.firstName,
          lastName: populatedMessage.targetUserId.lastName
        }
      });
    }
    
    // แจ้งเตือนผู้ใช้ที่ถูก mention
    if (populatedMessage.mentionedUsers.length > 0) {
      populatedMessage.mentionedUsers.forEach(user => {
        io.to(user._id).emit('new mention', {
          spaceId,
          projectName: space.projectName,
          message: populatedMessage.message,
          mentionedBy: req.user.firstName + ' ' + req.user.lastName,
          link: `/space/item/${spaceId}/chat`
        });
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
      // ตรวจสอบว่าผู้ใช้ไม่ใช่ผู้ส่งข้อความ
      if (chat.userId.toString() !== userId.toString() && !chat.readBy.includes(userId)) {
        chat.readBy.push(userId);
        await chat.save();

        // แจ้ง client ว่าข้อความถูกอ่าน
        req.app.get('io').emit('message read update', {
          messageId: chat._id.toString(),
          readByCount: chat.readBy.length,
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ค้นหาผู้ใช้ตามชื่อ
exports.searchUsers = async (req, res) => {
  try {
    const { spaceId } = req.params;
    const { query } = req.query;

    // ค้นหา space และ populate collaborators.user
    const space = await Spaces.findById(spaceId).populate('collaborators.user', 'firstName lastName profileImage');
    if (!space) {
      return res.status(404).json({ success: false, error: "Space not found" });
    }

    // ดึงข้อมูลผู้ใช้จาก collaborators และกรอง user ที่ไม่ใช่ null และไม่ใช่ตัวเอง
    let users = space.collaborators
      .map(collab => collab.user)
      .filter(user => user !== null && user._id.toString() !== req.user._id.toString()); // ตรวจสอบว่า user ไม่ใช่ null และไม่ใช่ตัวเอง

    // ถ้ามี query ให้กรองผู้ใช้ตาม query
    if (query) {
      users = users.filter(user =>
        user.firstName.toLowerCase().includes(query.toLowerCase()) ||
        user.lastName.toLowerCase().includes(query.toLowerCase())
      );
    }

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ใน chatController.js
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

// แสดงหน้าแชทส่วนตัว
exports.renderPrivateChatPage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user.id;

    // ตรวจสอบว่า Space และผู้ใช้เป้าหมายมีอยู่จริง
    const space = await Spaces.findById(spaceId).populate('collaborators.user', 'username profileImage').lean();
    const targetUser = await User.findById(targetUserId).lean();

    if (!space || !targetUser) {
      return res.status(404).send("Space or target user not found");
    }

    // ดึงข้อความส่วนตัวระหว่างผู้ใช้สองคน
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
      .sort({ createdAt: 'asc' })
      .lean();

    // ฟังก์ชันสำหรับจัดรูปแบบวันที่
    const formatDate = (date) => {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('th-TH', options);
    };

    // ฟังก์ชันสำหรับจัดรูปแบบเวลา
    const formatTime = (date) => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // ชั่วโมง 0 จะเป็น 12 AM
      minutes = minutes < 10 ? '0' + minutes : minutes;
      return `${hours}:${minutes} ${ampm}`;
    };

    // ฟังก์ชันสำหรับตรวจสอบการเปลี่ยนวัน
    const isNewDay = (date1, date2) => {
      return (
        date1.getFullYear() !== date2.getFullYear() ||
        date1.getMonth() !== date2.getMonth() ||
        date1.getDate() !== date2.getDate()
      );
    };

    res.render('task/task-chat-private', {
      spaces: space,
      messages,
      user: req.user,
      targetUser,
      layout: '../views/layouts/task',
      currentPage: 'task_chat_private',
      formatDate,
      formatTime,
      isNewDay,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

// ส่งข้อความส่วนตัว
exports.sendPrivateMessage = async (req, res) => {
  try {
    const spaceId = req.params.id;
    const targetUserId = req.params.targetUserId;
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || !userId || !spaceId || !targetUserId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const newMessage = new Chat({
      spaceId,
      userId,
      targetUserId,
      message,
      type: 'private',
      readBy: [], // เริ่มต้นด้วยค่าว่าง
    });

    await newMessage.save();
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('targetUserId', 'firstName lastName profileImage')
      .lean();

    const io = req.app.get('io');
    io.to(`private_${userId}_${targetUserId}`).emit('private message', populatedMessage);
    io.to(`private_${targetUserId}_${userId}`).emit('private message', populatedMessage);

    // ตรวจสอบว่า targetUserId อยู่ในหน้าแชทหรือไม่
    const usersInChat = req.app.get('usersInChat');
    if (usersInChat.has(targetUserId) && usersInChat.get(targetUserId).has(userId)) {
      // ถ้า targetUserId อยู่ในหน้าแชท ให้อัปเดต readBy
      if (userId !== targetUserId) { // ตรวจสอบไม่ให้ผู้ส่งตัวเองเพิ่มเข้าไปใน readBy
        newMessage.readBy.push(targetUserId);
        await newMessage.save();

        io.to(`private_${userId}_${targetUserId}`).emit('private message read', {
          messageId: newMessage._id.toString(),
          readByCount: newMessage.readBy.length,
        });
      }
    }



    res.status(200).json({ success: true, message: populatedMessage });
  } catch (error) {
    console.log("Error sending private message:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// อัปเดตสถานะการอ่านข้อความส่วนตัว
exports.markPrivateMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Chat.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: "Message not found" });
    }

    const usersInChat = req.app.get('usersInChat');
    if (usersInChat.has(userId) && usersInChat.get(userId).has(message.targetUserId.toString())) {
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
        await message.save();
      }
    }

    if (!message.readBy.includes(userId) && message.userId.toString() !== userId) {
      message.readBy.push(userId);
      await message.save();
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};