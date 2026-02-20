const Upload = (() => {
  let onUploadSuccess = null;

  function init(callback) {
    onUploadSuccess = callback;

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  function showStatus(message, type) {
    const el = document.getElementById('upload-status');
    el.textContent = message;
    el.className = type; // 'error', 'success', 'loading'
  }

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['vtdb', 'tdb'].includes(ext)) {
      showStatus('Unsupported file type. Please upload a .vtdb or .tdb file.', 'error');
      return;
    }

    showStatus('Parsing tool database...', 'loading');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        showStatus(data.error || 'Upload failed', 'error');
        return;
      }

      showStatus(
        `Parsed ${data.stats.total} tools (${data.stats.compatible} compatible, ${data.stats.incompatible} incompatible)`,
        'success'
      );

      if (onUploadSuccess) onUploadSuccess(data);
    } catch (err) {
      showStatus('Network error: ' + err.message, 'error');
    }
  }

  return { init };
})();
