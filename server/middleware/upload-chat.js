const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/chat_files/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // ใช้ชื่อไฟล์ต้นฉบับโดยตรง
    const originalname = file.originalname;
    const ext = path.extname(originalname);
    const basename = path.basename(originalname, ext);
    
    // สร้างชื่อไฟล์ใหม่โดยรักษานามสกุลไฟล์
    cb(null, `chat-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // อนุญาตเฉพาะไฟล์บางประเภท (ปรับแต่งตามต้องการ)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // อนุญาตสูงสุด 5 ไฟล์
  },
  fileFilter: fileFilter
});

module.exports = upload;