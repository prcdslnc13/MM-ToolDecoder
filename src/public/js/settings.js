const Settings = (() => {
  let onChange = null;

  function init(callback) {
    onChange = callback;

    const inputs = [
      'setting-ramp-angle',
      'setting-ramp-rate',
      'setting-tip-length',
      'setting-vendor',
      'setting-spec-url',
    ];

    for (const id of inputs) {
      document.getElementById(id).addEventListener('input', () => {
        if (onChange) onChange(getValues());
      });
    }
  }

  function getValues() {
    const rampRate = document.getElementById('setting-ramp-rate').value;
    return {
      RampAngle: parseFloat(document.getElementById('setting-ramp-angle').value) || 22.5,
      RampRate: rampRate !== '' ? parseFloat(rampRate) : null,
      TipLength: parseFloat(document.getElementById('setting-tip-length').value) || 0,
      Vendor: document.getElementById('setting-vendor').value || '',
      ToolSpecURL: document.getElementById('setting-spec-url').value || '',
    };
  }

  function show() {
    document.getElementById('settings-section').classList.remove('hidden');
  }

  return { init, getValues, show };
})();
