const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

const app = express();
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

const UPLOAD_FOLDER = '/tmp/temp-files';
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

const retentionMinutes = process.env.FILE_RETENTION ? parseInt(process.env.FILE_RETENTION, 10) : 30;
const retentionTime = retentionMinutes * 60 * 1000;

const fileSizeLimitMb = process.env.FILE_SIZE_LIMIT ? parseInt(process.env.FILE_SIZE_LIMIT, 10) : 10;
const fileSizeLimitBytes = fileSizeLimitMb * 1024 * 1024;

const uploadTracker = {};
const uploadLimit = process.env.UPLOAD_LIMIT ? parseInt(process.env.UPLOAD_LIMIT, 10) : 5;
const uploadWindow = 5 * 60 * 1000;
const blockDuration = 5 * 60 * 1000;

function checkAndUpdateUploadTracker(ip) {
  const now = Date.now();
  let tracker = uploadTracker[ip];
  if (!tracker) {
    tracker = { count: 1, firstUploadTime: now, blockUntil: 0 };
    uploadTracker[ip] = tracker;
    return tracker;
  }
  if (tracker.blockUntil && now < tracker.blockUntil) {
    return tracker;
  }
  if (now - tracker.firstUploadTime > uploadWindow) {
    tracker.count = 1;
    tracker.firstUploadTime = now;
    tracker.blockUntil = 0;
  } else {
    tracker.count += 1;
    if (tracker.count > uploadLimit) {
      tracker.blockUntil = now + blockDuration;
    }
  }
  return tracker;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ 
  storage, 
  limits: { fileSize: fileSizeLimitBytes } 
});

const fileStore = {};

app.post('/upload', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;
  const tracker = checkAndUpdateUploadTracker(ip);
  if (tracker.blockUntil && Date.now() < tracker.blockUntil) {
    const waitTime = Math.ceil((tracker.blockUntil - Date.now()) / 60000);
    console.log(`[${new Date().toISOString()}] Blocking upload from IP ${ip} for ${waitTime} minute(s) due to spam.`);
    return res.status(429).json({ error: `Too many uploads. Please try again in ${waitTime} minute(s).` });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        console.error(`[${new Date().toISOString()}] Upload error: File exceeds ${fileSizeLimitMb} MB limit.`);
        return res.status(413).json({ error: `Uploaded file exceeds the allowed file size of ${fileSizeLimitMb} MB.` });
      }
      console.error(`[${new Date().toISOString()}] Upload error:`, err);
      return res.status(500).json({ error: 'An error occurred during file upload.' });
    }

    const fileId = uuidv4();
    const filePath = req.file.path;
    const originalName = req.file.originalname;

    const deleteTimeout = setTimeout(() => {
      cleanupFile(fileId);
    }, retentionTime);

    fileStore[fileId] = { path: filePath, timeoutHandle: deleteTimeout };

    console.log(
      `[${new Date().toISOString()}] File uploaded: ${originalName} (ID: ${fileId}), stored at ${filePath}. ` +
      `Client IP: ${ip}. Retention: ${retentionMinutes} minute(s).`
    );

    const host = process.env.PUBLIC_DOMAIN || req.get('host');
    const prefix = req.get('X-Forwarded-Prefix') || '';
    const fileLink = `${req.protocol}://${host}${prefix}/file/${fileId}`;
    res.json({ fileLink, originalName, retentionMinutes });
  });
});

app.get('/file/:id', (req, res) => {
  const { id } = req.params;
  const fileRecord = fileStore[id];
  if (!fileRecord) {
    return res.status(404).send('File not found or it may have expired.');
  }
  return res.download(fileRecord.path, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    }
  });
});

function cleanupFile(fileId) {
  const fileRecord = fileStore[fileId];
  if (fileRecord) {
    clearTimeout(fileRecord.timeoutHandle);
    fsExtra.remove(fileRecord.path)
      .then(() => console.log(`[${new Date().toISOString()}] Deleted file: ${fileRecord.path}`))
      .catch((err) => console.error(`Error deleting file ${fileRecord.path}:`, err));
    delete fileStore[fileId];
  }
}

app.use(express.static(path.join(__dirname, 'public')));

const serverInstance = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`File retention time: ${retentionMinutes} minute(s), File size limit: ${fileSizeLimitMb} MB, Upload limit: ${uploadLimit} per 5 minutes.`);
});

async function cleanupFolder() {
  try {
    await fsExtra.remove(UPLOAD_FOLDER);
    console.log(`Cleaned up temporary folder: ${UPLOAD_FOLDER}`);
  } catch (error) {
    console.error(`Error cleaning up temporary folder ${UPLOAD_FOLDER}:`, error);
  }
}

const shutdown = () => {
  console.log('Terminating server, cleaning up temporary files...');
  serverInstance.close(async () => {
    await cleanupFolder();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

