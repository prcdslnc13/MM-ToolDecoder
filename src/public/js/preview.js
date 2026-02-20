const Preview = (() => {
  function show() {
    document.getElementById('preview-section').classList.remove('hidden');
  }

  function renderSourceTable(tools, format) {
    document.getElementById('source-format').textContent = format;

    const compatible = tools.filter(t => t.compatible).length;
    const incompatible = tools.length - compatible;
    document.getElementById('source-stats').innerHTML = `
      <span class="stat"><span class="stat-dot compatible"></span> ${compatible} compatible</span>
      <span class="stat"><span class="stat-dot incompatible"></span> ${incompatible} incompatible</span>
      <span class="stat">${tools.length} total</span>
    `;

    const tbody = document.getElementById('source-tbody');
    tbody.innerHTML = '';

    for (const tool of tools) {
      const tr = document.createElement('tr');
      if (!tool.compatible) tr.classList.add('incompatible');

      const diameterStr = tool.metricTool
        ? (tool.diameter || 0).toFixed(2) + ' mm'
        : (tool.diameter || 0).toFixed(4) + '"';

      tr.innerHTML = `
        <td>${escapeHtml(tool.name || '(unnamed)')}</td>
        <td>${escapeHtml(tool.sourceType)}</td>
        <td>${diameterStr}</td>
        <td>${escapeHtml(tool.category || '')}</td>
        <td><span class="status-icon ${tool.compatible ? 'ok' : 'warn'}">${tool.compatible ? '\u2713' : '\u2717'}</span></td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderConverted(output) {
    const container = document.getElementById('converted-categories');
    container.innerHTML = '';

    const categories = Object.keys(output);
    if (categories.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:1rem;">No compatible tools to display.</p>';
      return;
    }

    for (const category of categories) {
      const tools = output[category];
      const count = Object.keys(tools).length;

      const group = document.createElement('div');
      group.className = 'category-group';

      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <span>${escapeHtml(category)}</span>
        <span>
          <span class="count">${count} tool${count !== 1 ? 's' : ''}</span>
          <span class="arrow">\u25BC</span>
        </span>
      `;

      const jsonBlock = document.createElement('div');
      jsonBlock.className = 'category-json';

      // Pretty print just this category's tools
      const categoryObj = { [category]: tools };
      jsonBlock.textContent = JSON.stringify(categoryObj, null, 4);

      header.addEventListener('click', () => {
        header.classList.toggle('collapsed');
        jsonBlock.classList.toggle('hidden');
      });

      group.appendChild(header);
      group.appendChild(jsonBlock);
      container.appendChild(group);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { show, renderSourceTable, renderConverted };
})();
