const express    = require('express');
const multer     = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs         = require('fs');
const path       = require('path');
const fsExtra    = require('fs-extra');

const {
  PORT,
  UPLOAD_FOLDER,
  RETENTION_TIME,
  FILE_RETENTION,
  UPLOAD_LIMIT,
  UPLOAD_WINDOW,
  BLOCK_DURATION,
  FILE_SIZE_LIMIT,
  PUBLIC_DOMAIN
} = require('../config/variables');

const app = express();
app.set('trust proxy', true);

let serverInstance;

const uploadTracker = {};
const fileStore     = {};

if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

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
  if (now - tracker.firstUploadTime > UPLOAD_WINDOW) {
    tracker.count = 1;
    tracker.firstUploadTime = now;
    tracker.blockUntil = 0;
  } else {
    tracker.count += 1;
    if (tracker.count > UPLOAD_LIMIT) {
      tracker.blockUntil = now + BLOCK_DURATION;
    }
  }
  return tracker;
}

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage });

app.get('/config', (req, res) => {
  res.json({ maxFileSizeMb: FILE_SIZE_LIMIT });
});

app.post('/upload', (req, res) => {
  const ip = req.headers['x-real-ip'] || req.ip;
  const tracker = checkAndUpdateUploadTracker(ip);

  if (tracker.blockUntil && Date.now() < tracker.blockUntil) {
    const waitTime = Math.ceil((tracker.blockUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Too many uploads. Please try again in ${waitTime} minute(s).` });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] Upload error:`, err);
      return res.status(500).json({ error: 'An error occurred during file upload.' });
    }
    const fileId      = uuidv4();
    const filePath    = req.file.path;
    const originalName= req.file.originalname;
    const mimeType    = req.file.mimetype;

    const deleteTimeout = setTimeout(() => {
      cleanupFile(fileId);
    }, RETENTION_TIME);

    fileStore[fileId] = {
      path: filePath,
      timeoutHandle: deleteTimeout,
      mimeType
    };

    console.log(`[${new Date().toISOString()}] File uploaded: ${originalName} (ID: ${fileId}), stored at ${filePath}. Client IP: ${ip}. Retention: ${FILE_RETENTION} minute(s).`);
    
    const host = PUBLIC_DOMAIN || req.get('host');
    const prefix = req.get('X-Forwarded-Prefix') || '';
    const fileLink = `${req.protocol}://${host}${prefix}/file/${fileId}`;

    const isTextFile = mimeType.startsWith('text/');
    const textViewLink = isTextFile ? `${req.protocol}://${host}${prefix}/text/${fileId}` : null;

    return res.json({
      fileLink,
      originalName,
      retentionMinutes: FILE_RETENTION,
      ...(textViewLink ? { textViewLink } : {})
    });
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

app.get('/text/:id', (req, res) => {
  const { id } = req.params;
  const fileRecord = fileStore[id];
  if (!fileRecord) {
    return res.status(404).send('File not found or it may have expired.');
  }
  if (!fileRecord.mimeType || !fileRecord.mimeType.startsWith('text/')) {
    return res.status(415).send('Not a text file or viewing as text is not supported.');
  }
  fs.readFile(fileRecord.path, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return res.status(500).send('Error reading file.');
    }
    res.type('text/plain');
    res.send(data);
  });
});

app.use(express.static(path.join(__dirname, '../client')));

async function start() {
  serverInstance = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function cleanupFolder() {
  try {
    await fsExtra.remove(UPLOAD_FOLDER);
    console.log(`Cleaned up folder: ${UPLOAD_FOLDER}`);
  } catch (error) {
    console.error(`Error cleaning up folder ${UPLOAD_FOLDER}:`, error);
  }
}

async function shutdown() {
  console.log('Terminating server...');
  if (serverInstance) {
    serverInstance.close(async () => {
      await cleanupFolder();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

module.exports = {
  start,
  shutdown
};

