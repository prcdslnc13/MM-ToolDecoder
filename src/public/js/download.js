const Download = (() => {
  let currentData = null;
  let currentFilename = null;

  function init() {
    document.getElementById('download-btn').addEventListener('click', () => {
      if (!currentData) return;

      const json = JSON.stringify(currentData, null, 4);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = currentFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function setData(output, filename) {
    currentData = output;
    currentFilename = filename;
    document.getElementById('download-section').classList.remove('hidden');
  }

  return { init, setData };
})();
