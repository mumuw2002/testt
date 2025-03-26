const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Directories for uploads
const fileUploadDir = 'docUploads/';
const coverUploadDir = 'public/projectCover/';

// Ensure directories exist
if (!fs.existsSync(fileUploadDir)) {
    fs.mkdirSync(fileUploadDir, { recursive: true });
}
if (!fs.existsSync(coverUploadDir)) {
    fs.mkdirSync(coverUploadDir, { recursive: true });
}

// Configure Multer storage for files
const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, fileUploadDir);
    },
    filename: (req, file, cb) => {
        const safeFilename = file.originalname.replace(/[\s]/g, '_'); // Replace spaces with underscores
        cb(null, safeFilename);
    }
});

// Configure Multer storage for cover images
const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, coverUploadDir);
    },
    filename: (req, file, cb) => {
        const safeFilename = file.originalname.replace(/[\s]/g, '_'); // Replace spaces with underscores
        cb(null, safeFilename);
    }
});

// File filter to accept only specific types
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.docx', '.doc', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// Set up the upload middleware with size limits (e.g., 5MB)
const uploadFiles = multer({
    storage: fileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter,
});

const uploadCovers = multer({
    storage: coverStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter,
});

module.exports = {
    uploadFiles,
    uploadCovers
};