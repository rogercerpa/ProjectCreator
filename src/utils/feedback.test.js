import { confirmAction, inferFeedbackType, notify, registerFeedbackHandlers } from './feedback';

describe('inferFeedbackType', () => {
  test.each([
    ['Failed to save task: disk full', 'error'],
    ['❌ Backup failed: no access', 'error'],
    ['Settings saved with some errors:\nfoo', 'error'],
    ['Please select a template first.', 'warning'],
    ['Value cannot be empty', 'warning'],
    ['No email addresses found to send to.', 'warning'],
    ['Settings saved successfully!', 'success'],
    ['✅ Folder selected successfully!', 'success'],
    ['Outlook email drafted with paid services details.', 'info']
  ])('%s -> %s', (message, expected) => {
    expect(inferFeedbackType(message)).toBe(expected);
  });
});

describe('notify / confirmAction', () => {
  test('route to registered handlers', async () => {
    const handlers = { notify: jest.fn(), confirm: jest.fn().mockResolvedValue(true) };
    const unregister = registerFeedbackHandlers(handlers);

    notify('Settings saved successfully!');
    expect(handlers.notify).toHaveBeenCalledWith('Settings saved successfully!', 'success', {});
    await expect(confirmAction('Delete this?', { destructive: true })).resolves.toBe(true);
    expect(handlers.confirm).toHaveBeenCalledWith('Delete this?', { destructive: true });

    unregister();
  });

  test('fall back to native dialogs when no provider is mounted', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    notify('hello');
    expect(alertSpy).toHaveBeenCalledWith('hello');
    await expect(confirmAction('sure?')).resolves.toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith('sure?');
  });
});
