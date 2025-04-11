const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeDefaultImage() {
    try {
        const inputPath = path.join(__dirname, '../public/spacePictures/defultBackground.webp');
        const outputPath = path.join(__dirname, '../public/spacePictures/defultBackground_optimized.webp');
        
        // ตรวจสอบว่ามีไฟล์ต้นฉบับหรือไม่
        if (!fs.existsSync(inputPath)) {
            console.log('ไฟล์ต้นฉบับไม่พบ ข้ามการปรับขนาด');
            return;
        }

        await sharp(inputPath)
            .resize(1200, 400)
            .webp({ quality: 75 })
            .toFile(outputPath);
        
        console.log('สร้างไฟล์รูปภาพที่ปรับขนาดแล้วเรียบร้อย:', outputPath);
    } catch (err) {
        console.error('เกิดข้อผิดพลาดในการปรับขนาดรูปภาพ:', err);
    }
}

// เรียกใช้งานฟังก์ชัน
optimizeDefaultImage();