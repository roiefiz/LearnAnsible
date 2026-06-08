(function () {
  const container = document.getElementById('tree');
  const tooltip = document.getElementById('tooltip');
  const detailEmpty = document.getElementById('detail-empty');
  const detailContent = document.getElementById('detail-content');
  const detailTitle = document.getElementById('detail-title');
  const detailInfo = document.getElementById('detail-info');
  const detailNoSample = document.getElementById('detail-no-sample');
  const detailCodeBlock = document.getElementById('detail-code-block');
  const detailPath = document.getElementById('detail-path');
  const detailCode = document.getElementById('detail-code');
  const detailRunHint = document.getElementById('detail-run-hint');
  const copyBtn = document.getElementById('copy-btn');

  let selectedRow = null;

  function formatInfo(text) {
    return text.replace(/\n/g, '\n').replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function renderTree() {
    TREE.forEach((item, index) => {
      if (item.type === 'spacer') {
        const div = document.createElement('div');
        div.style.height = '4px';
        container.appendChild(div);
        return;
      }

      const div = document.createElement('div');
      const hasSample = Boolean(item.sampleId && SAMPLES[item.sampleId]);
      const isInteractive = Boolean(item.info);

      div.className = 'tree-line';
      if (isInteractive) div.classList.add('clickable');
      if (hasSample) div.classList.add('has-sample');
      div.dataset.index = index;

      const colors = getColors(item.type);
      const isDir = item.icon === 'folder';
      const isAnsible = item.type.includes('ansible');
      const labelClass = isDir ? 'dir' : 'file';
      const extraClass = isAnsible ? (isDir ? 'ansible' : 'ansible-file') : '';

      let html = `<span class="indent">${item.indent}</span>`;
      const iconChar = getIconChar(item.icon);
      if (iconChar) {
        html += `<span class="icon" style="color:${colors.icon}">${iconChar}</span>`;
      }
      html += `<span class="label ${labelClass} ${extraClass}" style="color:${colors.label}">${item.label}</span>`;
      if (hasSample) {
        html += '<span class="sample-dot" title="Click to view code"></span>';
      }

      div.innerHTML = html;

      if (item.info) {
        div.addEventListener('mouseenter', () => {
          tooltip.innerHTML = `<strong>${item.title || item.label}</strong>${item.info}`;
          tooltip.classList.add('show');
          tooltip.style.top = (div.offsetTop + div.offsetHeight + 4) + 'px';
        });
        div.addEventListener('mouseleave', () => tooltip.classList.remove('show'));

        div.addEventListener('click', () => selectItem(item, div));
      }

      container.appendChild(div);
    });
  }

  function selectItem(item, row) {
    if (selectedRow) selectedRow.classList.remove('selected');
    selectedRow = row;
    row.classList.add('selected');
    tooltip.classList.remove('show');

    detailEmpty.hidden = true;
    detailContent.hidden = false;

    detailTitle.textContent = item.title || item.label;
    detailInfo.innerHTML = formatInfo(item.info || '');

    const sample = item.sampleId ? SAMPLES[item.sampleId] : null;

    if (sample) {
      detailNoSample.hidden = true;
      detailCodeBlock.hidden = false;
      detailPath.textContent = `ansible/${item.sampleId}`;
      detailCode.textContent = sample.content;
      detailCode.className = `language-${sample.language}`;

      if (sample.runHint) {
        detailRunHint.textContent = sample.runHint;
        detailRunHint.hidden = false;
      } else {
        detailRunHint.hidden = true;
      }

      if (window.Prism) {
        Prism.highlightElement(detailCode);
      }
    } else {
      detailCodeBlock.hidden = true;
      detailNoSample.hidden = false;
      detailRunHint.hidden = true;
    }

    copyBtn.textContent = 'Copy';
    copyBtn.classList.remove('copied');
  }

  function clearSelection() {
    if (selectedRow) {
      selectedRow.classList.remove('selected');
      selectedRow = null;
    }
    detailEmpty.hidden = false;
    detailContent.hidden = true;
  }

  copyBtn.addEventListener('click', async () => {
    const text = detailCode.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch {
      copyBtn.textContent = 'Failed';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSelection();
  });

  renderTree();
})();
