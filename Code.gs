const APP_NAME = '{{APP_NAME}}';

/**
 * Retrieve configuration values from script properties.
 * @returns {{sheetId:string, sheetName:string, driveFolderId:string, adminPass:string}}
 */
function getScriptConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    sheetId: props.getProperty('SHEET_ID') || '{{SHEET_ID}}',
    sheetName: props.getProperty('SHEET_NAME') || '{{SHEET_NAME}}',
    driveFolderId: props.getProperty('DRIVE_FOLDER_ID') || '{{DRIVE_FOLDER_ID}}',
    adminPass: props.getProperty('ADMIN_PASS') || '{{ADMIN_PASS}}',
  };
}

/**
 * Convenience wrapper to access the configured spreadsheet sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet() {
  const config = getScriptConfig();
  if (!config.sheetId || config.sheetId === '{{SHEET_ID}}') {
    throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID โปรดสร้างฐานข้อมูลจากหน้า Settings');
  }
  const sheetName = config.sheetName && config.sheetName !== '{{SHEET_NAME}}' ? config.sheetName : 'documents';
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  if (typeof ensureSheetHeaders === 'function') {
    ensureSheetHeaders(sheet);
  } else {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  }
  if (!config.sheetName || config.sheetName === '{{SHEET_NAME}}') {
    PropertiesService.getScriptProperties().setProperty('SHEET_NAME', sheetName);
  }
  return sheet;
}

/**
 * Handle GET requests by serving the compiled HTML frontend.
 */
function doGet() {
  Logger.log('[doGet] %s', new Date().toISOString());
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Handle POST requests for JSON-based API actions.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action;
    const payload = body.payload || {};
    Logger.log('[doPost] action=%s payload=%s', action, JSON.stringify(summarizePayload(payload)));
    const data = handleApiRequest(action, payload, {
      requestOrigin: 'doPost',
    });
    return ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('[doPost][error] %s', err && err.stack ? err.stack : err);
    const errorResponse = {
      ok: false,
      error: err && err.message ? err.message : 'Unexpected error',
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Shared handler for all API actions. Can be invoked via doPost or directly from the client using google.script.run.
 * @param {string} action
 * @param {Object} payload
 * @param {Object} [context]
 */
function handleApiRequest(action, payload, context) {
  const ctx = context || {};
  Logger.log('[handleApiRequest] action=%s triggeredFrom=%s', action, ctx.requestOrigin || 'client');
  if (!action) {
    throw new Error('Missing action parameter');
  }
  switch (action) {
    case 'ping':
      return { timestamp: new Date().toISOString(), app: APP_NAME };
    case 'list':
      return listDocuments(payload);
    case 'get':
      return getDocument(payload);
    case 'create':
      return createDocument(payload, ctx);
    case 'update':
      return updateDocument(payload, ctx);
    case 'archive':
      return archiveDocument(payload, ctx);
    case 'upload':
      return uploadFiles(payload, ctx);
    case 'remindCheck':
      return runReminderCheck(payload, ctx);
    case 'backupSheet':
      return runBackupSheet(payload, ctx);
    case 'exportCSV':
      return exportSheetAs('csv');
    case 'exportJSON':
      return exportSheetAs('json');
    case 'createTriggers':
      return createAutoTriggers();
    case 'deleteTriggers':
      return deleteAutoTriggers();
    case 'provisionWorkspace':
      return provisionWorkspace(payload, ctx);
    case 'settings':
      return getAdminSettings();
    case 'verifyAdmin':
      return verifyAdminPassword(payload);
    default:
      throw new Error('Unknown action: ' + action);
  }
}

/**
 * Include HTML partial files.
 */
function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

/**
 * Provide a summarized payload for logging without large blobs.
 */
function summarizePayload(payload) {
  if (!payload) return payload;
  const clone = JSON.parse(JSON.stringify(payload));
  if (clone.files) {
    clone.files = clone.files.map(function (file) {
      return {
        name: file.name,
        size: file.base64 ? file.base64.length : file.size,
        type: file.type,
      };
    });
  }
  return clone;
}
