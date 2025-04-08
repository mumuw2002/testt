const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/chat_files/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // ใช้ชื่อไฟล์ต้นฉบับโดยตรง โดยไม่แปลง encoding
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, 'chat-' + uniqueSuffix + path.extname(originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // อนุญาตสูงสุด 5 ไฟล์
  },
  // เพิ่มการกำหนด fileFilter เพื่ออนุญาตไฟล์ที่มีชื่อภาษาไทย
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

module.exports = upload;