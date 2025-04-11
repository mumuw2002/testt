// server/utils/fileHelpers.js
const path = require('path');
const fs = require('fs').promises;

exports.deleteOldFiles = async (filePath) => {
    if (!filePath || filePath.includes('defaultBackground')) return;
    
    try {
        const base = path.parse(filePath).name.split('_')[0];
        const dir = path.dirname(filePath);
        
        const files = await fs.readdir(dir);
        await Promise.all(files.map(file => {
            if (file.startsWith(base)) {
                return fs.unlink(path.join(dir, file))
                    .catch(() => {});
            }
        }));
    } catch (err) {
        console.error('Error deleting old files:', err);
        throw err; // หรือ return false ถ้าต้องการ
    }
};