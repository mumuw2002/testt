// utils/imageHelpers.js

// ตัวอย่างฟังก์ชัน resizeImage ที่สร้าง URL สำหรับขนาดที่ต้องการ
function resizeImage(imageUrl, size) {
    if (!imageUrl) return '';
    // โค้ดนี้เป็นเพียงตัวอย่าง สมมุติว่า URL รูปภาพสามารถใส่พารามิเตอร์ขนาดได้
    // คุณสามารถเปลี่ยนเป็นการทำงานที่เหมาะสมกับระบบของคุณ เช่น ใช้บริการ CDN ที่รองรับการเปลี่ยนขนาดรูป เป็นต้น
    return `${imageUrl}?size=${size}`;
  }
  
  function convertToWebp(imageUrl) {
    if (!imageUrl) return '';
    // สมมุติว่าแปลงนามสกุลไฟล์เป็น .webp
    return imageUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }
  
  module.exports = { resizeImage, convertToWebp };
  