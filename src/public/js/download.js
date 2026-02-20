const Download = (() => {
  let currentUploadId = null;

  function init() {
    document.getElementById('download-btn').addEventListener('click', () => {
      if (!currentUploadId) return;
      window.location.href = `/api/download/${currentUploadId}`;
    });
  }

  function show(uploadId) {
    currentUploadId = uploadId;
    document.getElementById('download-section').classList.remove('hidden');
  }

  return { init, show };
})();
