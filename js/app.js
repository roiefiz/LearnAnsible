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
  const expandAllBtn = document.getElementById('expand-all');
  const collapseAllBtn = document.getElementById('collapse-all');

  let selectedNodeId = null;
  let selectedRow = null;
  const expanded = new Set();
  const hierarchy = buildTreeHierarchy(TREE);

  function getDepthFromIndent(indent) {
    if (!indent) return 0;
    const prefix = indent.replace(/[├└]── ?$/, '');
    if (!prefix) return 1;

    let groups = 0;
    let i = 0;
    while (i < prefix.length) {
      if (prefix[i] === '│') {
        groups++;
        i++;
        while (i < prefix.length && prefix[i] === ' ') i++;
      } else if (prefix.substring(i, i + 4) === '    ') {
        groups++;
        i += 4;
      } else {
        i++;
      }
    }
    return groups + 1;
  }

  function buildTreeHierarchy(flatItems) {
    const virtualRoot = { children: [] };
    const stack = [virtualRoot];

    flatItems.forEach((item, flatIndex) => {
      if (item.type === 'spacer') return;

      const depth = getDepthFromIndent(item.indent);
      while (stack.length > depth + 1) {
        stack.pop();
      }

      const isFolder = item.icon === 'folder';
      const node = {
        ...item,
        id: `node-${flatIndex}`,
        flatIndex,
        depth,
        isFolder,
        children: [],
      };

      stack[stack.length - 1].children.push(node);
      if (isFolder) {
        stack.push(node);
      }
    });

    return virtualRoot.children;
  }

  function collectExpandableIds(nodes, ids = []) {
    for (const node of nodes) {
      if (node.isFolder && node.children.length > 0) {
        ids.push(node.id);
        collectExpandableIds(node.children, ids);
      }
    }
    return ids;
  }

  function findPathToNode(nodeId, nodes, path = []) {
    for (const node of nodes) {
      const nextPath = [...path, node];
      if (node.id === nodeId) return nextPath;
      const found = findPathToNode(nodeId, node.children, nextPath);
      if (found) return found;
    }
    return null;
  }

  function isNodeVisible(nodeId) {
    const path = findPathToNode(nodeId, hierarchy);
    if (!path) return false;
    for (let i = 0; i < path.length - 1; i++) {
      const ancestor = path[i];
      if (ancestor.isFolder && ancestor.children.length > 0 && !expanded.has(ancestor.id)) {
        return false;
      }
    }
    return true;
  }

  function initExpandedAll() {
    collectExpandableIds(hierarchy).forEach((id) => expanded.add(id));
  }

  function formatInfo(text) {
    return text.replace(/\n/g, '\n').replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function toggleExpand(nodeId, event) {
    event.stopPropagation();
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId);
    } else {
      expanded.add(nodeId);
    }
    refreshTree();
  }

  function expandAll() {
    collectExpandableIds(hierarchy).forEach((id) => expanded.add(id));
    refreshTree();
  }

  function collapseAll() {
    expanded.clear();
    hierarchy.forEach((node) => {
      if (node.isFolder && node.children.length > 0) {
        expanded.add(node.id);
      }
    });
    refreshTree();
  }

  function renderNode(node) {
    if (node.sectionGap) {
      const gap = document.createElement('div');
      gap.className = 'tree-section-gap';
      container.appendChild(gap);
    }

    const div = document.createElement('div');
    const hasSample = Boolean(node.sampleId && SAMPLES[node.sampleId]);
    const isInteractive = Boolean(node.info);
    const hasChildren = node.isFolder && node.children.length > 0;
    const isExpanded = hasChildren && expanded.has(node.id);

    div.className = 'tree-line';
    if (isInteractive) div.classList.add('clickable');
    if (hasSample) div.classList.add('has-sample');
    if (node.isFolder) div.classList.add('is-folder');
    div.dataset.nodeId = node.id;
    div.style.paddingLeft = `${node.depth * 16}px`;

    const colors = getColors(node.type);
    const isAnsible = node.type.includes('ansible');
    const labelClass = node.isFolder ? 'dir' : 'file';
    const extraClass = isAnsible ? (node.isFolder ? 'ansible' : 'ansible-file') : '';

    let html = '';
    if (hasChildren) {
      html += `<button type="button" class="tree-chevron" aria-expanded="${isExpanded}" aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${node.label}">${isExpanded ? '▾' : '▸'}</button>`;
    } else {
      html += '<span class="tree-chevron-spacer" aria-hidden="true"></span>';
    }

    const iconChar = getIconChar(node.icon);
    if (iconChar) {
      html += `<span class="icon" style="color:${colors.icon}">${iconChar}</span>`;
    }
    html += `<span class="label ${labelClass} ${extraClass}" style="color:${colors.label}">${node.label}</span>`;
    if (hasSample) {
      html += '<span class="sample-dot" title="Click to view code"></span>';
    }

    div.innerHTML = html;

    if (hasChildren) {
      const chevron = div.querySelector('.tree-chevron');
      chevron.addEventListener('click', (event) => toggleExpand(node.id, event));
    }

    if (node.info) {
      div.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<strong>${node.title || node.label}</strong>${node.info}`;
        tooltip.classList.add('show');
        tooltip.style.top = (div.offsetTop + div.offsetHeight + 4) + 'px';
      });
      div.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
      div.addEventListener('click', () => selectItem(node, div));
    }

    container.appendChild(div);

    if (hasChildren && isExpanded) {
      node.children.forEach((child) => renderNode(child));
    }
  }

  function markSectionGaps(nodes) {
    const depthOneFolders = nodes.filter((n) => n.depth === 1 && n.isFolder);
    depthOneFolders.forEach((node, index) => {
      if (index > 0) node.sectionGap = true;
    });
  }

  function refreshTree() {
    if (selectedNodeId && !isNodeVisible(selectedNodeId)) {
      clearSelection();
    }

    container.innerHTML = '';
    hierarchy.forEach((node) => renderNode(node));

    if (selectedNodeId) {
      const row = container.querySelector(`[data-node-id="${selectedNodeId}"]`);
      if (row) {
        selectedRow = row;
        row.classList.add('selected');
      }
    }
  }

  function selectItem(node, row) {
    if (selectedRow) selectedRow.classList.remove('selected');
    selectedNodeId = node.id;
    selectedRow = row;
    row.classList.add('selected');
    tooltip.classList.remove('show');

    detailEmpty.hidden = true;
    detailContent.hidden = false;

    detailTitle.textContent = node.title || node.label;
    detailInfo.innerHTML = formatInfo(node.info || '');

    const sample = node.sampleId ? SAMPLES[node.sampleId] : null;

    if (sample) {
      detailNoSample.hidden = true;
      detailCodeBlock.hidden = false;
      detailPath.textContent = `ansible/${node.sampleId}`;
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
    selectedNodeId = null;
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

  if (expandAllBtn) expandAllBtn.addEventListener('click', expandAll);
  if (collapseAllBtn) collapseAllBtn.addEventListener('click', collapseAll);

  if (hierarchy[0]?.children) {
    markSectionGaps(hierarchy[0].children);
  }
  initExpandedAll();
  refreshTree();
})();
