const SHEET_HEADERS = [
  'id', 'title', 'category', 'tags', 'owner', 'issueDate', 'expiryDate', 'remindDays',
  'driveFileId', 'driveFileUrl', 'version', 'location', 'source', 'status', 'notes',
  'createdAt', 'updatedAt'
];

/**
 * Get script properties helper.
 */
function getAdminSettings() {
  const config = getScriptConfig();
  return {
    sheetId: config.sheetId,
    sheetName: config.sheetName,
    driveFolderId: config.driveFolderId,
    appName: APP_NAME,
  };
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map(function (t) { return t.toString().trim(); }).filter(Boolean);
  }
  return tags.toString().split(',').map(function (t) { return t.trim(); }).filter(Boolean);
}

function verifyAdminPassword(payload) {
  const password = payload && payload.password ? payload.password.toString() : '';
  const config = getScriptConfig();
  const valid = password && password === config.adminPass;
  if (!valid) {
    throw new Error('Invalid admin password');
  }
  return { valid: true };
}

/**
 * Convert a sheet row array to an object.
 */
function rowToObject(row) {
  const obj = {};
  SHEET_HEADERS.forEach(function (key, index) {
    obj[key] = row[index] !== undefined ? row[index] : '';
  });
  if (obj.tags && typeof obj.tags === 'string') {
    obj.tags = obj.tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  } else if (!obj.tags) {
    obj.tags = [];
  }
  if (obj.remindDays === '') obj.remindDays = 0;
  obj.remindDays = Number(obj.remindDays || 0);
  obj.remindDays = isNaN(obj.remindDays) ? 0 : obj.remindDays;
  obj.driveFiles = parseDriveFiles(obj.driveFileId, obj.driveFileUrl, obj.version);
  obj.versionHistory = parseVersionHistory(obj.version);
  obj.createdAt = obj.createdAt || '';
  obj.updatedAt = obj.updatedAt || '';
  return obj;
}

function parseDriveFiles(idCell, urlCell, versionCell) {
  var ids = (idCell || '').toString().trim();
  var urls = (urlCell || '').toString().trim();
  if (!ids) return [];
  var idParts = ids.split('|');
  var urlParts = urls.split('|');
  var history = parseVersionHistory(versionCell);
  return idParts.map(function (id, index) {
    var historyEntry = history.find(function (entry) { return entry.fileId === id; }) || {};
    return {
      id: id,
      url: urlParts[index] || '',
      name: historyEntry.fileName || historyEntry.version || ('ไฟล์ ' + (index + 1)),
      uploadedAt: historyEntry.uploadedAt || '',
    };
  });
}

function parseVersionHistory(versionCell) {
  if (!versionCell) return [];
  if (versionCell.trim().startsWith('[')) {
    try {
      return JSON.parse(versionCell);
    } catch (err) {
      Logger.log('[parseVersionHistory] failed %s', err);
    }
  }
  return versionCell.split('|').filter(Boolean).map(function (entry, index) {
    return {
      version: entry,
      note: 'Legacy entry #' + (index + 1),
    };
  });
}

/**
 * Convert an object back to a row array.
 */
function objectToRow(obj) {
  return SHEET_HEADERS.map(function (key) {
    if (key === 'tags') {
      return Array.isArray(obj.tags) ? obj.tags.join(',') : obj.tags || '';
    }
    if (key === 'driveFileId') {
      return (obj.driveFiles || []).map(function (file) { return file.id; }).join('|');
    }
    if (key === 'driveFileUrl') {
      return (obj.driveFiles || []).map(function (file) { return file.url; }).join('|');
    }
    if (key === 'version') {
      return JSON.stringify(obj.versionHistory || []);
    }
    return obj[key] !== undefined ? obj[key] : '';
  });
}

/**
 * Retrieve all document rows from the sheet.
 */
function getAllDocuments() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  const range = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length);
  const values = range.getValues();
  return values.map(rowToObject);
}

/**
 * Locate a document row index (1-based) by ID.
 */
function findDocumentRow(id) {
  if (!id) return -1;
  const sheet = getSheet();
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (var i = 0; i < ids.length; i += 1) {
    if (ids[i][0] === id) {
      return i + 2; // account for header row
    }
  }
  return -1;
}

/**
 * List documents with filters, sorting, and pagination.
 */
function listDocuments(payload) {
  const filters = payload || {};
  const page = Number(filters.page || 1);
  const pageSize = Number(filters.pageSize || 20);
  const keyword = (filters.keyword || '').toString().toLowerCase();
  const category = (filters.category || '').toString().toLowerCase();
  const status = (filters.status || '').toString().toLowerCase();
  const issueRange = filters.issueRange || {};
  const expiryRange = filters.expiryRange || {};
  const sort = filters.sort || {};

  const allDocs = getAllDocuments();
  const filtered = allDocs.filter(function (doc) {
    if (keyword) {
      const haystack = [doc.title, doc.notes, doc.source, doc.owner]
        .concat(doc.tags)
        .join(' ') + ' ' + doc.id;
      if (haystack.toLowerCase().indexOf(keyword) === -1) return false;
    }
    if (category && doc.category.toLowerCase() !== category) return false;
    if (status && doc.status.toLowerCase() !== status) return false;

    if (issueRange && (issueRange.start || issueRange.end)) {
      const issueDate = doc.issueDate ? new Date(doc.issueDate) : null;
      if (issueRange.start) {
        const startDate = new Date(issueRange.start);
        if (!issueDate || issueDate < startDate) return false;
      }
      if (issueRange.end) {
        const endDate = new Date(issueRange.end);
        if (!issueDate || issueDate > endDate) return false;
      }
    }

    if (expiryRange && (expiryRange.start || expiryRange.end)) {
      const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
      if (expiryRange.start) {
        const startDate = new Date(expiryRange.start);
        if (!expiryDate || expiryDate < startDate) return false;
      }
      if (expiryRange.end) {
        const endDate = new Date(expiryRange.end);
        if (!expiryDate || expiryDate > endDate) return false;
      }
    }

    return true;
  });

  if (sort && sort.field) {
    const direction = (sort.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    filtered.sort(function (a, b) {
      const av = (a[sort.field] || '').toString().toLowerCase();
      const bv = (b[sort.field] || '').toString().toLowerCase();
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.max(Math.min(page, totalPages), 1);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const summary = buildSummary(allDocs);

  return {
    items: items,
    page: safePage,
    pageSize: pageSize,
    total: total,
    totalPages: totalPages,
    summary: summary,
  };
}

function buildSummary(allDocs) {
  var total = allDocs.length;
  var now = new Date();
  var aboutToExpire = 0;
  var expired = 0;
  allDocs.forEach(function (doc) {
    if (!doc.expiryDate) return;
    var expiry = new Date(doc.expiryDate);
    if (expiry < now) {
      expired += 1;
    } else {
      var diffDays = Math.ceil((expiry - now) / (1000 * 3600 * 24));
      if (diffDays <= (doc.remindDays || 0)) {
        aboutToExpire += 1;
      }
    }
  });
  return {
    total: total,
    aboutToExpire: aboutToExpire,
    expired: expired,
  };
}

/**
 * Retrieve a single document.
 */
function getDocument(payload) {
  const id = payload.id;
  if (!id) throw new Error('Missing document id');
  const rowIndex = findDocumentRow(id);
  if (rowIndex === -1) throw new Error('Document not found');
  const sheet = getSheet();
  const row = sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0];
  return rowToObject(row);
}

/**
 * Create a new document entry.
 */
function createDocument(payload, ctx) {
  validateDocumentPayload(payload, true);
  const nowIso = new Date().toISOString();
  const doc = {
    id: Utilities.getUuid(),
    title: payload.title.trim(),
    category: payload.category || '',
    tags: normalizeTags(payload.tags),
    owner: payload.owner || '',
    issueDate: payload.issueDate || '',
    expiryDate: payload.expiryDate || '',
    remindDays: Number(payload.remindDays || 0),
    driveFiles: payload.driveFiles || [],
    location: payload.location || '',
    source: payload.source || '',
    status: payload.status || 'active',
    notes: payload.notes || '',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const versionHistory = buildVersionHistory(payload.driveFiles, null);
  doc.versionHistory = versionHistory;

  const sheet = getSheet();
  sheet.appendRow(objectToRow(doc));
  Logger.log('[createDocument] id=%s ctx=%s', doc.id, JSON.stringify(ctx));
  return doc;
}

/**
 * Update an existing document entry.
 */
function updateDocument(payload, ctx) {
  validateDocumentPayload(payload, false);
  const id = payload.id;
  if (!id) throw new Error('Missing document id');
  const rowIndex = findDocumentRow(id);
  if (rowIndex === -1) throw new Error('Document not found');
  const sheet = getSheet();
  const row = sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const existing = rowToObject(row);

  const nowIso = new Date().toISOString();
  existing.title = payload.title !== undefined ? payload.title : existing.title;
  existing.category = payload.category !== undefined ? payload.category : existing.category;
  existing.tags = payload.tags !== undefined ? normalizeTags(payload.tags) : existing.tags;
  existing.owner = payload.owner !== undefined ? payload.owner : existing.owner;
  existing.issueDate = payload.issueDate !== undefined ? payload.issueDate : existing.issueDate;
  existing.expiryDate = payload.expiryDate !== undefined ? payload.expiryDate : existing.expiryDate;
  existing.remindDays = payload.remindDays !== undefined ? Number(payload.remindDays) : existing.remindDays;
  existing.location = payload.location !== undefined ? payload.location : existing.location;
  existing.source = payload.source !== undefined ? payload.source : existing.source;
  existing.status = payload.status !== undefined ? payload.status : existing.status;
  existing.notes = payload.notes !== undefined ? payload.notes : existing.notes;
  existing.updatedAt = nowIso;

  if (payload.driveFiles) {
    existing.driveFiles = payload.driveFiles;
    existing.versionHistory = buildVersionHistory(payload.driveFiles, existing.versionHistory);
  }

  sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).setValues([objectToRow(existing)]);
  Logger.log('[updateDocument] id=%s ctx=%s', id, JSON.stringify(ctx));
  return existing;
}

/**
 * Archive a document (soft delete).
 */
function archiveDocument(payload, ctx) {
  const id = payload.id;
  if (!id) throw new Error('Missing document id');
  const rowIndex = findDocumentRow(id);
  if (rowIndex === -1) throw new Error('Document not found');
  const sheet = getSheet();
  const row = sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const existing = rowToObject(row);
  existing.status = 'archived';
  existing.updatedAt = new Date().toISOString();
  sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).setValues([objectToRow(existing)]);
  Logger.log('[archiveDocument] id=%s ctx=%s', id, JSON.stringify(ctx));
  return existing;
}

/**
 * Validate payload for create/update operations.
 */
function validateDocumentPayload(payload, isCreate) {
  if (!payload) throw new Error('Payload missing');
  if (!payload.title || !payload.title.toString().trim()) {
    throw new Error('Title is required');
  }
  if (payload.issueDate && payload.expiryDate) {
    var issue = new Date(payload.issueDate);
    var expiry = new Date(payload.expiryDate);
    if (issue > expiry) {
      throw new Error('Issue date must be before or equal to expiry date');
    }
  }
  if (payload.remindDays !== undefined) {
    var remind = Number(payload.remindDays);
    if (isNaN(remind) || remind < 0) {
      throw new Error('remindDays must be a non-negative number');
    }
  }
}

/**
 * Upload files to Drive folder and return metadata.
 */
function uploadFiles(payload) {
  const config = getScriptConfig();
  const folder = DriveApp.getFolderById(config.driveFolderId);
  const files = payload.files || [];
  if (!files.length) {
    throw new Error('No files provided');
  }
  const uploaded = files.map(function (file, index) {
    const blob = Utilities.newBlob(Utilities.base64Decode(file.base64), file.type || 'application/octet-stream', file.name || ('file-' + index));
    const driveFile = folder.createFile(blob);
    driveFile.setDescription('Uploaded via ' + APP_NAME);
    const info = {
      id: driveFile.getId(),
      url: 'https://drive.google.com/open?id=' + driveFile.getId(),
      name: file.name || driveFile.getName(),
      uploadedAt: new Date().toISOString(),
    };
    Logger.log('[uploadFiles] %s', JSON.stringify(info));
    return info;
  });
  return {
    files: uploaded,
  };
}

/**
 * Build version history by merging new files with previous history.
 */
function buildVersionHistory(files, previousHistory) {
  var history = Array.isArray(previousHistory) ? previousHistory.slice() : [];
  var timestamp = new Date().toISOString();
  if (files && files.length) {
    files.forEach(function (file) {
      var exists = history.some(function (entry) { return entry.fileId === file.id; });
      if (exists) return;
      var versionLabel = 'v' + (history.length + 1);
      history.push({
        version: versionLabel,
        fileId: file.id,
        fileUrl: file.url,
        fileName: file.name,
        uploadedAt: file.uploadedAt || timestamp,
      });
    });
  }
  return history;
}

/**
 * Reminder check triggered daily.
 */
function runReminderCheck(payload, ctx) {
  const allDocs = getAllDocuments();
  const today = new Date();
  const dueDocs = allDocs.filter(function (doc) {
    if (doc.status !== 'active') return false;
    if (!doc.expiryDate) return false;
    const expiry = new Date(doc.expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 3600 * 24));
    return diffDays <= (doc.remindDays || 0) && diffDays >= 0;
  });

  if (!dueDocs.length) {
    Logger.log('[runReminderCheck] no documents to remind');
    return { sent: 0 };
  }

  const recipient = Session.getEffectiveUser().getEmail();
  var webAppUrl = '';
  try {
    webAppUrl = ScriptApp.getService().getUrl();
  } catch (err) {
    Logger.log('[runReminderCheck] cannot get web app url %s', err);
  }
  dueDocs.forEach(function (doc) {
    const subject = '[Document Expiry Notice] ' + doc.title;
    const lines = [
      'เอกสาร: ' + doc.title,
      'เจ้าของ: ' + (doc.owner || '-'),
      'วันหมดอายุ: ' + (doc.expiryDate || '-'),
      'สถานะ: ' + doc.status,
      'ลิงก์เว็บแอป: ' + webAppUrl,
    ];
    if (doc.driveFiles && doc.driveFiles.length) {
      lines.push('ไฟล์:');
      doc.driveFiles.forEach(function (file) {
        lines.push(' - ' + file.name + ': ' + file.url);
      });
    }
    const body = lines.join('\n');
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      body: body,
    });
    Logger.log('[runReminderCheck] sent for %s', doc.id);
  });

  return {
    sent: dueDocs.length,
    recipient: recipient,
  };
}

/**
 * Backup sheet into Drive folder with timestamp.
 */
function runBackupSheet(payload, ctx) {
  const config = getScriptConfig();
  const folder = DriveApp.getFolderById(config.driveFolderId);
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const copy = spreadsheet.copy(APP_NAME + ' backup ' + timestamp);
  folder.addFile(copy);
  const parent = copy.getParents();
  while (parent.hasNext()) {
    var p = parent.next();
    if (p.getId() !== folder.getId()) {
      p.removeFile(copy);
    }
  }
  Logger.log('[runBackupSheet] backupId=%s', copy.getId());
  return {
    backupId: copy.getId(),
    backupUrl: 'https://docs.google.com/spreadsheets/d/' + copy.getId(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Export sheet as CSV or JSON (string data for download on client).
 */
function exportSheetAs(type) {
  const docs = getAllDocuments();
  if (type === 'csv') {
    const rows = [SHEET_HEADERS.join(',')];
    docs.forEach(function (doc) {
      const row = objectToRow(doc).map(function (value) {
        const str = value !== undefined && value !== null ? value.toString() : '';
        if (str.indexOf(',') >= 0 || str.indexOf('\"') >= 0) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      rows.push(row.join(','));
    });
    return {
      mimeType: 'text/csv',
      filename: APP_NAME + '-export.csv',
      content: rows.join('\n'),
    };
  }
  return {
    mimeType: 'application/json',
    filename: APP_NAME + '-export.json',
    content: JSON.stringify(docs, null, 2),
  };
}
