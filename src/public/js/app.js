(() => {
  let currentTools = null;
  let currentOriginalName = null;

  // Initialize all modules
  Upload.init(onUploadSuccess);
  Settings.init(onSettingsChange);
  Download.init();

  async function onUploadSuccess(data) {
    currentTools = data.tools;
    currentOriginalName = data.originalName;

    // Show panels
    Settings.show();
    Preview.show();
    Preview.renderSourceTable(data.tools, data.format);

    // Trigger initial conversion
    runConversion();
  }

  function onSettingsChange() {
    if (!currentTools) return;
    runConversion();
  }

  function runConversion() {
    const defaults = Settings.getValues();
    const { output, stats } = Converter.convert(currentTools, defaults);

    Preview.renderConverted(output);

    const filename = currentOriginalName.replace(/\.[^.]+$/, '') + '.tools';
    Download.setData(output, filename);
  }
})();
