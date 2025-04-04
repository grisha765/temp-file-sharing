require('dotenv').config();

const PORT               = process.env.PORT || 3000;
const FILE_RETENTION     = parseInt(process.env.FILE_RETENTION, 10) || 30;
const UPLOAD_LIMIT       = parseInt(process.env.UPLOAD_LIMIT, 10) || 5;
const FILE_SIZE_LIMIT    = parseInt(process.env.FILE_SIZE_LIMIT, 10) || 10;
const PUBLIC_DOMAIN      = process.env.PUBLIC_DOMAIN || '';
const UPLOAD_FOLDER      = process.env.UPLOAD_FOLDER || '/tmp/temp-files';

const RETENTION_TIME     = FILE_RETENTION * 60 * 1000;
const UPLOAD_WINDOW      = 5 * 60 * 1000;
const BLOCK_DURATION     = 5 * 60 * 1000;

module.exports = {
  PORT,
  FILE_RETENTION,
  UPLOAD_LIMIT,
  FILE_SIZE_LIMIT,
  PUBLIC_DOMAIN,
  UPLOAD_FOLDER,
  RETENTION_TIME,
  UPLOAD_WINDOW,
  BLOCK_DURATION
};

