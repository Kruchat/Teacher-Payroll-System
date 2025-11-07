/**
 * Create automatic triggers for reminders and backups.
 */
function createAutoTriggers() {
  deleteAutoTriggers();
  ScriptApp.newTrigger('handleReminderTrigger')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  ScriptApp.newTrigger('handleBackupTrigger')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();
  Logger.log('[createAutoTriggers] created');
  return {
    ok: true,
    message: 'Triggers created',
  };
}

/**
 * Delete triggers created by this script.
 */
function deleteAutoTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    const handler = trigger.getHandlerFunction();
    if (handler === 'handleReminderTrigger' || handler === 'handleBackupTrigger') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('[deleteAutoTriggers] removed relevant triggers');
  return {
    ok: true,
    message: 'Triggers removed',
  };
}

/**
 * Trigger entry point for reminder check.
 */
function handleReminderTrigger() {
  Logger.log('[handleReminderTrigger] fired');
  handleApiRequest('remindCheck', { trigger: true }, { requestOrigin: 'trigger' });
}

/**
 * Trigger entry point for backups.
 */
function handleBackupTrigger() {
  Logger.log('[handleBackupTrigger] fired');
  handleApiRequest('backupSheet', { trigger: true }, { requestOrigin: 'trigger' });
}
