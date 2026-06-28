// SOFI - Backend Formularios
// Recebe formularios publicos, salva respostas em Google Sheets e fotos no Google Drive.

function doPost(e) {
  var body = {}
  try { body = JSON.parse(e.postData.contents || '{}') } catch (err) { body = {} }

  var method = String(body._method || 'POST').toUpperCase()
  var path = String(body._path || '').replace(/^\/+/, '')

  try {
    if (path === 'promoter-forms/public-backup') {
      return jsonResponse(promoterPublicBackupRoute(method, body))
    }
    if (path === 'health') {
      return jsonResponse({ ok: true, app: 'SOFI Formularios', ts: new Date().toISOString() })
    }
    return jsonResponse({ error: 'Rota nao encontrada', code: 404 })
  } catch (err) {
    return jsonResponse({ error: err.message || 'Erro interno', code: err.code || 500 })
  }
}

function doGet(e) {
  return jsonResponse({ ok: true, app: 'SOFI - Backend Formularios', ts: new Date().toISOString() })
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}

function setupSpreadsheet() {
  var props = PropertiesService.getScriptProperties()
  var spreadsheetId = props.getProperty('SPREADSHEET_ID')
  var spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.create('SOFI - Banco de Dados Formularios')

  props.setProperty('SPREADSHEET_ID', spreadsheet.getId())
  ensurePromoterPublicBackupsSheet_()
  Logger.log('Planilha configurada: ' + spreadsheet.getUrl())
  return { ok: true, spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl() }
}

function authorizeDrive() {
  var folders = DriveApp.getFoldersByName('SOFI - Fotos dos Formularios')
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('SOFI - Fotos dos Formularios')
  Logger.log('Drive autorizado. Pasta de fotos: ' + folder.getUrl())
  return { ok: true, folderUrl: folder.getUrl() }
}

function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  if (!id) throw new Error('SPREADSHEET_ID nao configurado. Execute setupSpreadsheet primeiro.')
  return SpreadsheetApp.openById(id)
}

function ensurePromoterPublicBackupsSheet_() {
  var ss = getSpreadsheet()
  var sheet = ss.getSheetByName('promoter_form_submissions')
  var headers = [
    'id', 'promoterName', 'unit', 'role', 'phone', 'email', 'birthDate', 'address',
    'photoDataUrl', 'photoUrl', 'photoDriveFileId', 'photoName', 'notes', 'answersJson', 'computedJson',
    'submittedAt', 'status', 'storageStatus', 'driveErrorsJson', 'rawJson'
  ]

  if (!sheet) sheet = ss.insertSheet('promoter_form_submissions')
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1B3A6B')
      .setFontColor('#FFFFFF')
    sheet.setFrozenRows(1)
    sheet.setColumnWidths(1, headers.length, 180)
  }
  return sheet
}

function promoterPublicBackupRoute(method, body) {
  var sheet = ensurePromoterPublicBackupsSheet_()

  if (method === 'GET') {
    return { ok: true, submissions: readPromoterSubmissions_(sheet) }
  }

  if (method === 'POST') {
    var submission = body.submission || {}
    var id = submission.id || Utilities.getUuid()
    var photo = savePromoterPhoto_(submission, id)
    var photoDataUrl = submission.photoDataUrl || (submission.photoBase64 && submission.photoMimeType ? 'data:' + submission.photoMimeType + ';base64,' + submission.photoBase64 : '')
    delete submission.photoBase64

    var saved = {
      id: id,
      promoterName: submission.promoterName || '',
      unit: submission.unit || '',
      role: submission.role || '',
      phone: submission.phone || '',
      email: submission.email || '',
      birthDate: submission.birthDate || '',
      address: submission.address || '',
      photoDataUrl: photoDataUrl,
      photoUrl: photo.url || submission.photoUrl || '',
      photoDriveFileId: photo.id || submission.photoDriveFileId || '',
      photoName: photo.name || submission.photoName || '',
      photoError: photo.error || '',
      notes: submission.notes || '',
      answers: submission.answers || {},
      computed: submission.computed || {},
      submittedAt: submission.submittedAt || new Date().toISOString(),
      status: submission.status || 'received',
      storageStatus: submission.storageStatus || 'google_sheets_backup',
      driveErrors: submission.driveErrors || []
    }

    sheet.appendRow([
      saved.id, saved.promoterName, saved.unit, saved.role, saved.phone, saved.email,
      saved.birthDate, saved.address, saved.photoDataUrl, saved.photoUrl, saved.photoDriveFileId, saved.photoName,
      saved.notes, JSON.stringify(saved.answers), JSON.stringify(saved.computed),
      saved.submittedAt, saved.status, saved.storageStatus, JSON.stringify(saved.driveErrors),
      JSON.stringify(saved)
    ])

    return { ok: true, storage: 'google_sheets_backup', submission: saved }
  }

  return { error: 'Metodo nao suportado', code: 405 }
}

function savePromoterPhoto_(submission, id) {
  if (!submission.photoBase64 || !submission.photoMimeType) return {}
  try {
    var folders = DriveApp.getFoldersByName('SOFI - Fotos dos Formularios')
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('SOFI - Fotos dos Formularios')
    var safeName = String(submission.photoName || (submission.promoterName || id) + '-foto.jpg')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .slice(0, 120)
    var blob = Utilities.newBlob(Utilities.base64Decode(submission.photoBase64), submission.photoMimeType, safeName)
    var file = folder.createFile(blob)
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    } catch (shareErr) {}
    return {
      id: file.getId(),
      name: file.getName(),
      url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
      webViewLink: file.getUrl()
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

function readPromoterSubmissions_(sheet) {
  var values = sheet.getDataRange().getValues()
  if (values.length < 2) return []
  var headers = values[0]
  return values.slice(1).filter(function(row) { return row[0] }).map(function(row) {
    var item = {}
    headers.forEach(function(header, index) { item[header] = row[index] === '' ? null : row[index] })
    try { item.answers = item.answersJson ? JSON.parse(item.answersJson) : {} } catch (err) { item.answers = {} }
    try { item.computed = item.computedJson ? JSON.parse(item.computedJson) : {} } catch (err) { item.computed = {} }
    try { item.driveErrors = item.driveErrorsJson ? JSON.parse(item.driveErrorsJson) : [] } catch (err) { item.driveErrors = [] }
    delete item.answersJson
    delete item.computedJson
    delete item.driveErrorsJson
    return item
  })
}
