var SHEET_NAME = "RecognitionCandidates";
var HEADERS = ["candidateKey", "taskId", "rawExpression", "candidateJson", "observationCount", "reviewStatus", "promotionStatus", "updatedAt"];
var UNKNOWN_SHEET_NAME = "UnresolvedUnknowns";
var UNKNOWN_HEADERS = ["unknownKey", "taskId", "rawTranscript", "unknownReason", "reasonSlotId", "observationCount", "reviewStatus", "updatedAt"];

function doGet(e) {
  if (!e || !e.parameter) return output_({ error: "not_found" });
  if (e.parameter.action === "getCandidates") return output_({ candidates: getCandidates() });
  if (e.parameter.action === "getUnresolvedUnknowns") return output_({ unresolvedUnknowns: getUnresolvedUnknowns() });
  return output_({ error: "not_found" });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 4096) throw new Error("invalid_payload");
    var body = JSON.parse(e.postData.contents);
    if (body.action === "recordObservation") return output_({ candidates: recordObservation(body.observation) });
    if (body.action === "updateReviewStatus") return output_({ candidates: updateReviewStatus(body.update) });
    if (body.action === "recordUnresolvedUnknown") return output_({ unresolvedUnknowns: recordUnresolvedUnknown(body.observation) });
    if (body.action === "updateUnresolvedReviewStatus") return output_({ unresolvedUnknowns: updateUnresolvedReviewStatus(body.update) });
    throw new Error("invalid_action");
  } catch (error) {
    return output_({ error: String(error && error.message || "invalid_request") });
  }
}

function setupRecognitionCandidatesSheet() {
  sheet_();
  unknownSheet_();
}

function recordUnresolvedUnknown(value) {
  var clean = cleanUnknown_(value), key = unknownKey_(clean), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = unknownSheet_(), values = sheet.getDataRange().getValues();
    for (var row = 1; row < values.length; row += 1) {
      if (values[row][0] === key) {
        sheet.getRange(row + 1, 6).setValue(Number(values[row][5] || 0) + 1);
        sheet.getRange(row + 1, 8).setValue(new Date().toISOString());
        return getUnresolvedUnknowns_unsafe_(sheet);
      }
    }
    sheet.appendRow([key, clean.taskId, clean.rawTranscript, clean.unknownReason, clean.reasonSlotId || "", 1, "pending", new Date().toISOString()]);
    return getUnresolvedUnknowns_unsafe_(sheet);
  } finally { lock.releaseLock(); }
}

function getUnresolvedUnknowns() {
  return getUnresolvedUnknowns_unsafe_(unknownSheet_());
}

function updateUnresolvedReviewStatus(value) {
  var clean = cleanUnknown_(value), status = value.reviewStatus;
  if (["reviewed", "ignored"].indexOf(status) < 0) throw new Error("invalid_unknown_review_status");
  var key = unknownKey_(clean), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = unknownSheet_(), values = sheet.getDataRange().getValues(), found = false;
    for (var row = 1; row < values.length; row += 1) {
      if (values[row][0] === key) {
        sheet.getRange(row + 1, 7).setValue(status);
        sheet.getRange(row + 1, 8).setValue(new Date().toISOString());
        found = true; break;
      }
    }
    if (!found) throw new Error("unresolved_unknown_not_found");
    return getUnresolvedUnknowns_unsafe_(sheet);
  } finally { lock.releaseLock(); }
}

function recordObservation(value) {
  var clean = clean_(value);
  var key = candidateKey_(clean);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = sheet_();
    var values = sheet.getDataRange().getValues();
    for (var row = 1; row < values.length; row += 1) {
      if (values[row][0] === key) {
        sheet.getRange(row + 1, 5).setValue(Number(values[row][4] || 0) + 1);
        sheet.getRange(row + 1, 8).setValue(new Date().toISOString());
        return getCandidates_unsafe_(sheet);
      }
    }
    sheet.appendRow([key, clean.taskId, clean.rawExpression, JSON.stringify(clean.candidate), 1, "pending", "not_ready", new Date().toISOString()]);
    return getCandidates_unsafe_(sheet);
  } finally { lock.releaseLock(); }
}

function getCandidates() {
  return getCandidates_unsafe_(sheet_());
}

function updateReviewStatus(value) {
  var clean = clean_(value);
  var review = value.reviewStatus;
  var promotion = value.promotionStatus;
  if ([undefined, "approved", "rejected"].indexOf(review) < 0 || [undefined, "ready"].indexOf(promotion) < 0 || (!review && !promotion)) {
    throw new Error("invalid_review_update");
  }
  var key = candidateKey_(clean);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = sheet_();
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var row = 1; row < values.length; row += 1) if (values[row][0] === key) { rowIndex = row; break; }
    if (rowIndex < 0) throw new Error("candidate_not_found");
    if (review) {
      sheet.getRange(rowIndex + 1, 6).setValue(review);
      sheet.getRange(rowIndex + 1, 7).setValue("not_ready");
    }
    if (promotion === "ready") {
      if (String(values[rowIndex][5]) !== "approved") throw new Error("candidate_not_approved");
      var task = clean.taskId, raw = clean.rawExpression.toLowerCase();
      var conflict = values.slice(1).some(function (entry) {
        return entry[0] !== key && String(entry[1]) === task && String(entry[2]).trim().toLowerCase() === raw;
      });
      if (conflict) throw new Error("candidate_conflict");
      sheet.getRange(rowIndex + 1, 7).setValue("ready");
    }
    sheet.getRange(rowIndex + 1, 8).setValue(new Date().toISOString());
    return getCandidates_unsafe_(sheet);
  } finally { lock.releaseLock(); }
}

function sheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function unknownSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(UNKNOWN_SHEET_NAME) || spreadsheet.insertSheet(UNKNOWN_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(UNKNOWN_HEADERS);
  return sheet;
}

function cleanUnknown_(value) {
  if (!value || typeof value.taskId !== "string" || typeof value.rawTranscript !== "string" || typeof value.unknownReason !== "string") {
    throw new Error("invalid_unresolved_unknown");
  }
  var clean = { taskId: value.taskId.trim(), rawTranscript: value.rawTranscript.trim(), unknownReason: value.unknownReason.trim(),
    reasonSlotId: typeof value.reasonSlotId === "string" && value.reasonSlotId.trim() ? value.reasonSlotId.trim() : null };
  if (!clean.taskId || !clean.rawTranscript || !clean.unknownReason || clean.taskId.length > 200 || clean.rawTranscript.length > 500 || clean.unknownReason.length > 100) {
    throw new Error("invalid_unresolved_unknown");
  }
  return clean;
}

function unknownKey_(value) {
  var canonical = JSON.stringify([value.taskId, value.rawTranscript.toLowerCase(), value.unknownReason, value.reasonSlotId]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical).map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}

function getUnresolvedUnknowns_unsafe_(sheet) {
  return sheet.getDataRange().getValues().slice(1).filter(function (row) { return row[0]; }).map(function (row) {
    return { taskId: String(row[1]), rawTranscript: String(row[2]), unknownReason: String(row[3]), reasonSlotId: row[4] ? String(row[4]) : null,
      observationCount: Number(row[5]), reviewStatus: String(row[6]) };
  });
}

function clean_(value) {
  if (!value || typeof value.taskId !== "string" || typeof value.rawExpression !== "string" || !value.candidate) throw new Error("invalid_candidate");
  var taskId = value.taskId.trim(), raw = value.rawExpression.trim(), source = value.candidate, candidate;
  if (!taskId || !raw || taskId.length > 200 || raw.length > 500) throw new Error("invalid_candidate");
  if (typeof source.slotId === "string" && Object.prototype.hasOwnProperty.call(source, "value")) candidate = { slotId: source.slotId, value: source.value };
  else if (typeof source.conceptId === "string") candidate = { conceptId: source.conceptId };
  else if (typeof source.token === "string") candidate = { token: source.token };
  else throw new Error("invalid_candidate");
  return { taskId: taskId, rawExpression: raw, candidate: candidate };
}

function candidateKey_(value) {
  var c = value.candidate;
  var canonical = JSON.stringify([value.taskId, value.rawExpression.toLowerCase(), c.slotId || "",
    Object.prototype.hasOwnProperty.call(c, "value") ? c.value : null, c.conceptId || "", c.token || ""]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical).map(function (byte) {
    return ("0" + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join("");
}

function getCandidates_unsafe_(sheet) {
  var values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function (row) { return row[0]; }).map(function (row) {
    return { taskId: String(row[1]), rawExpression: String(row[2]), candidate: JSON.parse(String(row[3])),
      observationCount: Number(row[4]), reviewStatus: String(row[5]), promotionStatus: String(row[6]) };
  });
}

function output_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
