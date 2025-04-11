const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // สร้างโฟลเดอร์ถ้ายังไม่มี
        const dir = 'public/spacePictures/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // ใช้ชื่อไฟล์เดิมแต่เปลี่ยนนามสกุลเป็น .webp
        const originalName = path.parse(file.originalname).name;
        cb(null, `${originalName}-${Date.now()}.webp`);
    }
});

const fileFilter = (req, file, cb) => {
    // อนุญาตเฉพาะไฟล์ภาพ
    if (file.mimetype === 'image/jpeg' || 
        file.mimetype === 'image/png' || 
        file.mimetype === 'image/webp') {
        cb(null, true);
    } else {
        cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP)'), false);
    }
};

const uploadCover = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 2MB
    fileFilter
});

const convertToWebP = async (req, res, next) => {
    if (!req.file) return next();
    
    try {
        const inputPath = req.file.path;
        const outputDir = 'public/spacePictures/';
        const originalName = path.parse(req.file.originalname).name;
        const timestamp = Date.now();
        
        // Create multiple sizes
        await Promise.all([
            // Large size (2x for retina)
            sharp(inputPath)
                .resize(1200, 400)
                .webp({ quality: 75 })
                .toFile(path.join(outputDir, `${originalName}-${timestamp}_1200.webp`)),
            
            // Medium size (1x)
            sharp(inputPath)
                .resize(600, 200)
                .webp({ quality: 75 })
                .toFile(path.join(outputDir, `${originalName}-${timestamp}_600.webp`))
        ]);
        
        fs.unlinkSync(inputPath);
        req.file.filename = `${originalName}-${timestamp}_600.webp`;
        req.file.path = path.join(outputDir, req.file.filename);
        
        next();
    } catch (err) {
        console.error('Error in convertToWebP:', err);
        next(err);
    }
};

module.exports = {
    uploadCover,
    convertToWebP
};