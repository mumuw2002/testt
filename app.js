require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const connectDB = require('./server/config/db');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo');
const path = require('path');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const LocalStrategy = require('passport-local').Strategy;
const User = require('./server/models/User');
const moment = require('moment');
const bodyParser = require('body-parser');
const lineWebhook = require('./server/routes/lineWebhook');
const http = require('http');
const socketIo = require('socket.io');
const Chat = require('./server/models/Chat');

const app = express();
const port = process.env.PORT || 5001;
const server = http.createServer(app);
const io = socketIo(server);

app.set('io', io);

// เชื่อมต่อฐานข้อมูล
connectDB()
  .then(() => {
    console.log('Connected to database');
  })
  .catch(err => {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  });

// Middleware สำหรับ parse body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session Middleware ✅ ต้องมาก่อน passport
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'Lax',
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(
  new LocalStrategy(
    { usernameField: 'googleEmail', passwordField: 'password' },
    User.authenticate()
  )
);

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/docUploads', express.static(path.join(__dirname, 'docUploads')));
app.use(methodOverride('_method'));
app.use('/webhook', lineWebhook);

// Flash messages
app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Middleware to handle due date validation
app.use((req, res, next) => {
  if (req.body.dueDate) {
    const dueDate = moment(req.body.dueDate, moment.ISO_8601, true);
    if (!dueDate.isValid()) {
      req.flash('error', 'Invalid date format');
      return res.redirect('back');
    }
    req.body.dueDate = dueDate.toISOString();
  }
  next();
});

// Update lastActive
app.use(async (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      req.user.lastActive = Date.now();
      await req.user.save();
    } catch (error) {
      console.error('Error updating lastActive:', error);
    }
  }
  next();
});

// Templating Engine
app.use(expressLayouts);
app.set('layout', './layouts/main');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(require('express-ejs-layouts'));

// Routes
app.use('/', require('./server/routes/auth'));
app.use('/', require('./server/routes/index'));
app.use('/', require('./server/routes/spaceRoutes'));
app.use('/', require('./server/routes/taskRou/taskRoutes'));
app.use('/', require('./server/routes/taskRou/taskPageRoutes'));
app.use('/', require('./server/routes/taskRou/taskDetailRoutes'));
app.use('/', require('./server/routes/taskRou/taskComplaintRouter'));
app.use('/', require('./server/routes/notiRoutes'));
app.use('/', require('./server/routes/subtaskRoutes'));
app.use('/', require('./server/routes/settingRoutes'));
app.use('/', require('./server/routes/userRoutes'));
app.use('/', require('./server/routes/collabRoutes'));

// Handle 404
app.get('*', (req, res) => {
  res.status(404).render('404');
});

// WebSocket Setup
// ตั้งค่า usersInChat ใน app
const usersInChat = new Map(); // เก็บข้อมูลผู้ใช้ที่อยู่ในหน้าแชท
app.set('usersInChat', usersInChat);

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // เมื่อผู้ใช้อยู่ในหน้าแชทกลุ่ม
  socket.on('user in chat', async ({ userId, spaceId }) => {
    if (!usersInChat.has(spaceId)) {
      usersInChat.set(spaceId, new Set());
    }
    usersInChat.get(spaceId).add(userId);

    console.log(`User ${userId} is in chat for space ${spaceId}`);

    // อัปเดตสถานะ readBy สำหรับข้อความที่ยังไม่ได้อ่าน
    const unreadMessages = await Chat.find({
      spaceId,
      readBy: { $ne: userId },
      type: 'group' // ดึงเฉพาะข้อความกลุ่ม
    });

    unreadMessages.forEach(async (msg) => {
      if (msg.userId.toString() !== userId.toString()) {
        msg.readBy.push(userId);
        await msg.save();

        io.emit('message read update', {
          messageId: msg._id.toString(),
          readByCount: msg.readBy.length,
        });
      }
    });
  });

  // เมื่อผู้ใช้ออกจากหน้าแชทกลุ่ม
  socket.on('user left chat', ({ userId, spaceId }) => {
    if (usersInChat.has(spaceId)) {
      usersInChat.get(spaceId).delete(userId);
      console.log(`User ${userId} left chat for space ${spaceId}`);
    }
  });

  // เมื่อผู้ใช้กลับเข้ามาในหน้าแชทกลุ่ม
  socket.on('user returned to chat', ({ userId, spaceId }) => {
    if (!usersInChat.has(spaceId)) {
      usersInChat.set(spaceId, new Set());
    }
    usersInChat.get(spaceId).add(userId);

    console.log(`User ${userId} returned to chat for space ${spaceId}`);

    Chat.find({
      spaceId,
      readBy: { $ne: userId },
      type: 'group' // ดึงเฉพาะข้อความกลุ่ม
    }).then((unreadMessages) => {
      unreadMessages.forEach((msg) => {
        if (msg.userId.toString() !== userId.toString()) {
          msg.readBy.push(userId);
          msg.save();

          io.emit('message read update', {
            messageId: msg._id.toString(),
            readByCount: msg.readBy.length,
          });
        }
      });
    });
  });

  // เมื่อมีข้อความใหม่
  socket.on('send message', async ({ spaceId, message, userId, mentionedUsers, type }) => {
    const newMessage = new Chat({
      spaceId,
      userId,
      message,
      readBy: [],
      mentionedUsers: mentionedUsers || [],
      type: type
    });


    if (type === 'group') {
      io.emit('chat message', populatedMessage);
      io.emit('update last group message', populatedMessage);
    } else if (type === 'private') {
      io.to(`private_${userId}_${targetUserId}`).emit('private message', populatedMessage);
      io.to(`private_${targetUserId}_${userId}`).emit('private message', populatedMessage);
      io.emit('update last private message', {
        userId: {
          _id: populatedMessage.userId._id.toString(),
          firstName: populatedMessage.userId.firstName,
          lastName: populatedMessage.userId.lastName
        },
        targetUserId: {
          _id: populatedMessage.targetUserId._id.toString(),
          firstName: populatedMessage.targetUserId.firstName,
          lastName: populatedMessage.targetUserId.lastName
        },
        message: populatedMessage.message,
        createdAt: populatedMessage.createdAt
      });
    }

    // แจ้งเตือนผู้ใช้ที่ถูก mention
    if (mentionedUsers && mentionedUsers.length > 0) {
      mentionedUsers.forEach(userId => {
        io.to(userId).emit('new mention', {
          spaceId,
          projectName: 'Project Name', // ควรดึงข้อมูลจากฐานข้อมูล
          message: populatedMessage.message,
          mentionedBy: populatedMessage.userId.firstName + ' ' + populatedMessage.userId.lastName,
          link: `/space/item/${spaceId}/chat`
        });
      });
    }

    // แจ้งเตือนผู้ใช้ที่ไม่ได้อยู่ในหน้าแชท
    const usersToNotify = usersInChat.get(spaceId) || new Set();
    usersToNotify.forEach(id => {
      if (id !== userId && !mentionedUsers.includes(id)) {
        io.to(id).emit('new unread message', {
          spaceId,
          projectName: 'Project Name', // ควรดึงข้อมูลจากฐานข้อมูล
          unreadCount: 1,
          lastMessage: message,
          link: `/space/item/${spaceId}/chat`
        });
      }
    });

    io.emit('new unread message', { spaceId, type });
  });

  // เมื่อผู้ใช้อยู่ในหน้าแชทส่วนตัว
  socket.on('user in private chat', async ({ userId, targetUserId }) => {
    socket.join(`private_${userId}_${targetUserId}`);
    console.log(`User ${userId} is in private chat with ${targetUserId}`);

    // เพิ่มการเก็บสถานะผู้ใช้
    if (!usersInChat.has(userId)) {
      usersInChat.set(userId, new Set());
    }
    usersInChat.get(userId).add(targetUserId);

    // อัปเดต readBy เฉพาะผู้ใช้อื่น
    if (usersInChat.has(targetUserId) && usersInChat.get(targetUserId).has(userId)) {
      const unreadMessages = await Chat.find({
        $or: [
          { userId: targetUserId, targetUserId: userId },
          { userId: userId, targetUserId: targetUserId }
        ],
        readBy: { $ne: userId },
        type: 'private',
      });

      unreadMessages.forEach(async (msg) => {
        if (msg.userId.toString() !== userId) { // กรองข้อความที่ผู้ส่งไม่ควรอ่าน
          msg.readBy.push(userId);
          await msg.save();

          io.to(`private_${targetUserId}_${userId}`).emit('private message read', {
            messageId: msg._id.toString(),
            readByCount: msg.readBy.length,
          });
        }
      });
    }
  });

  // เมื่อผู้ใช้ออกจากหน้าแชทส่วนตัว
  socket.on('user left private chat', ({ userId, targetUserId }) => {
    socket.leave(`private_${userId}_${targetUserId}`);
    console.log(`User ${userId} left private chat with ${targetUserId}`);

    if (usersInChat.has(userId)) {
      usersInChat.get(userId).delete(targetUserId);
      if (usersInChat.get(userId).size === 0) {
        usersInChat.delete(userId);
      }
    }
  });


  // เมื่อมีข้อความส่วนตัวใหม่
  socket.on('send private message', async ({ spaceId, message, userId, targetUserId }) => {
    const newMessage = new Chat({
      spaceId,
      userId,
      targetUserId,
      message,
      readBy: [], // เริ่มต้นด้วยค่าว่าง
      type: 'private',
    });

    await newMessage.save();
    const populatedMessage = await Chat.findById(newMessage._id)
      .populate('userId', 'firstName lastName profileImage')
      .populate('targetUserId', 'firstName lastName profileImage')
      .lean();


    if (newMessage.type === 'private') {
      io.to(`private_${userId}_${targetUserId}`).emit('private message', populatedMessage);
      io.to(`private_${targetUserId}_${userId}`).emit('private message', populatedMessage);
      io.emit('update last private message', {
        userId: {
          _id: populatedMessage.userId._id.toString(),
          firstName: populatedMessage.userId.firstName,
          lastName: populatedMessage.userId.lastName
        },
        targetUserId: {
          _id: populatedMessage.targetUserId._id.toString(),
          firstName: populatedMessage.targetUserId.firstName,
          lastName: populatedMessage.targetUserId.lastName
        },
        message: populatedMessage.message,
        createdAt: populatedMessage.createdAt
      });
    }

    // ตรวจสอบว่า targetUserId อยู่ในหน้าแชทหรือไม่
    if (usersInChat.has(targetUserId) && usersInChat.get(targetUserId).has(userId)) {
      // ถ้า targetUserId อยู่ในหน้าแชท ให้อัปเดต readBy
      newMessage.readBy.push(targetUserId);
      await newMessage.save();

      io.to(`private_${userId}_${targetUserId}`).emit('private message read', {
        messageId: newMessage._id.toString(),
        readByCount: newMessage.readBy.length,
      });
    }
    io.to(targetUserId).emit('new unread private message', { spaceId, senderId: userId });
  });

  socket.on('mark messages as read', async ({ spaceId, userId, targetUserId }) => {
    try {
      if (targetUserId) {
        // Mark private messages as read
        await Chat.updateMany(
          {
            spaceId,
            $or: [
              { userId: targetUserId, targetUserId: userId },
              { userId: userId, targetUserId: targetUserId }
            ],
            type: 'private',
            readBy: { $ne: userId },
            userId: { $ne: userId }
          },
          { $push: { readBy: userId } }
        );
      } else {
        // Mark group messages as read
        await Chat.updateMany(
          {
            spaceId,
            type: 'group',
            readBy: { $ne: userId },
            userId: { $ne: userId }
          },
          { $push: { readBy: userId } }
        );
      }

      io.emit('messages marked as read', { spaceId, userId, targetUserId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });
  socket.on('check user online status', async ({ userId }) => {
    try {
      const user = await User.findById(userId);
      if (user) {
        socket.emit('user online status', {
          userId,
          isOnline: user.isOnline
        });
      }
    } catch (error) {
      console.error('Error checking user online status:', error);
    }
  });
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});