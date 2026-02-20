(() => {
  let currentUploadId = null;
  let currentTools = null;

  // Initialize all modules
  Upload.init(onUploadSuccess);
  Settings.init(onSettingsChange);
  Download.init();

  async function onUploadSuccess(data) {
    currentUploadId = data.uploadId;
    currentTools = data.tools;

    // Show panels
    Settings.show();
    Preview.show();
    Preview.renderSourceTable(data.tools, data.format);

    // Trigger initial conversion
    await runConversion();
  }

  async function onSettingsChange() {
    if (!currentUploadId) return;
    await runConversion();
  }

  async function runConversion() {
    const defaults = Settings.getValues();

    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: currentUploadId, defaults }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Conversion error:', data.error);
        return;
      }

      Preview.renderConverted(data.output);
      Download.show(currentUploadId);
    } catch (err) {
      console.error('Conversion network error:', err);
    }
  }
})();
