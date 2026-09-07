const SPREADSHEET_ID = '1Gtbss0YP7nUpRoDqA3FKXwGsW7oRODy8jGrs-PMFpx8';
const SHEET_NAME = 'Sheet1';
const TURNSTILE_SECRET_PROPERTY = 'TURNSTILE_SECRET_KEY';

const HEADERS = [
  'submitted_at',
  'source_url',
  'type',
  'telegram_url',
  'title',
  'category',
  'tags',
  'description',
  'contact',
  'user_agent'
];

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.website_url) {
    return jsonResponse({ ok: true, skipped: true });
  }

  const telegramUrl = String(params.telegram_url || '').trim();
  const title = String(params.title || '').trim();
  const description = String(params.description || '').trim();
  const turnstileToken = String(params['cf-turnstile-response'] || '').trim();

  if (!verifyTurnstile_(turnstileToken)) {
    return jsonResponse({ ok: false, error: 'TURNSTILE_FAILED' });
  }

  if (!/^https:\/\/t\.me\/[A-Za-z0-9_+/?=&.-]+$/.test(telegramUrl)) {
    return jsonResponse({ ok: false, error: 'INVALID_TELEGRAM_URL' });
  }

  if (!title || !description) {
    return jsonResponse({ ok: false, error: 'MISSING_REQUIRED_FIELDS' });
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getTargetSheet_(spreadsheet);
  ensureHeaders_(sheet);

  sheet.appendRow(HEADERS.map((header) => {
    if (header === 'submitted_at') {
      return params.submitted_at || new Date().toISOString();
    }
    return params[header] || '';
  }));

  return jsonResponse({ ok: true });
}

function getTargetSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
}

function ensureHeaders_(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = currentHeaders.some((value) => String(value || '').trim() !== '');

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function verifyTurnstile_(token) {
  if (!token) {
    return false;
  }

  const secret = PropertiesService.getScriptProperties().getProperty(TURNSTILE_SECRET_PROPERTY);
  if (!secret) {
    throw new Error('Missing script property: ' + TURNSTILE_SECRET_PROPERTY);
  }

  const response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: {
      secret: secret,
      response: token
    },
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());
  return result.success === true;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
