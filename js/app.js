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
  const nodeById = new Map();
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

    flatItems.forEach(function (item, flatIndex) {
      if (item.type === 'spacer') return;

      const depth = getDepthFromIndent(item.indent);
      while (stack.length > depth + 1) {
        stack.pop();
      }

      const isFolder = item.icon === 'folder';
      const node = {
        indent: item.indent,
        icon: item.icon,
        label: item.label,
        type: item.type,
        info: item.info,
        title: item.title,
        sampleId: item.sampleId,
        id: 'node-' + flatIndex,
        flatIndex: flatIndex,
        depth: depth,
        isFolder: isFolder,
        children: [],
      };

      stack[stack.length - 1].children.push(node);
      nodeById.set(node.id, node);
      if (isFolder) {
        stack.push(node);
      }
    });

    return virtualRoot.children;
  }

  function collectExpandableIds(nodes, ids) {
    ids = ids || [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.isFolder && node.children.length > 0) {
        ids.push(node.id);
        collectExpandableIds(node.children, ids);
      }
    }
    return ids;
  }

  function findPathToNode(nodeId, nodes, path) {
    path = path || [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const nextPath = path.concat([node]);
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
    collectExpandableIds(hierarchy).forEach(function (id) {
      expanded.add(id);
    });
  }

  function formatInfo(text) {
    return text.replace(/\n/g, '\n').replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  function toggleExpand(nodeId) {
    if (expanded.has(nodeId)) {
      expanded.delete(nodeId);
    } else {
      expanded.add(nodeId);
    }
    updateTreeVisibility();
  }

  function expandAll() {
    collectExpandableIds(hierarchy).forEach(function (id) {
      expanded.add(id);
    });
    updateTreeVisibility();
  }

  function collapseAll() {
    expanded.clear();
    updateTreeVisibility();
  }

  function setChevronState(node, isExpanded) {
    const row = container.querySelector('[data-node-id="' + node.id + '"]');
    if (!row) return;
    const chevron = row.querySelector('.tree-chevron');
    if (!chevron) return;
    chevron.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    chevron.setAttribute('aria-label', (isExpanded ? 'Collapse ' : 'Expand ') + node.label);
    chevron.classList.toggle('is-expanded', isExpanded);
  }

  function updateTreeVisibility() {
    if (selectedNodeId && !isNodeVisible(selectedNodeId)) {
      clearSelection();
    }

    nodeById.forEach(function (node, nodeId) {
      const row = container.querySelector('[data-node-id="' + nodeId + '"]');
      if (!row) return;
      const visible = isNodeVisible(nodeId);
      row.hidden = !visible;

      const gap = container.querySelector('[data-gap-for="' + nodeId + '"]');
      if (gap) gap.hidden = !visible;

      if (node.isFolder && node.children.length > 0) {
        setChevronState(node, expanded.has(node.id));
      }
    });
  }

  function renderNode(node) {
    if (node.sectionGap) {
      const gap = document.createElement('div');
      gap.className = 'tree-section-gap';
      gap.dataset.gapFor = node.id;
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
    if (hasChildren) div.classList.add('has-children');
    div.dataset.nodeId = node.id;
    div.style.paddingLeft = (node.depth * 16) + 'px';

    const colors = getColors(node.type);
    const isAnsible = node.type.indexOf('ansible') !== -1;
    const labelClass = node.isFolder ? 'dir' : 'file';
    const extraClass = isAnsible ? (node.isFolder ? 'ansible' : 'ansible-file') : '';

    let html = '';
    if (hasChildren) {
      html += '<button type="button" class="tree-chevron' + (isExpanded ? ' is-expanded' : '') + '" data-node-id="' + node.id + '" aria-expanded="' + isExpanded + '" aria-label="' + (isExpanded ? 'Collapse ' : 'Expand ') + node.label + '"></button>';
    } else {
      html += '<span class="tree-chevron-spacer" aria-hidden="true"></span>';
    }

    const iconChar = getIconChar(node.icon);
    if (iconChar) {
      html += '<span class="icon" style="color:' + colors.icon + '">' + iconChar + '</span>';
    }
    html += '<span class="label ' + labelClass + ' ' + extraClass + '" style="color:' + colors.label + '">' + node.label + '</span>';
    if (hasSample) {
      html += '<span class="sample-dot" title="Click to view code"></span>';
    }

    div.innerHTML = html;

    if (node.info) {
      div.addEventListener('mouseenter', function () {
        tooltip.innerHTML = '<strong>' + (node.title || node.label) + '</strong>' + node.info;
        tooltip.classList.add('show');
        tooltip.style.top = (div.offsetTop + div.offsetHeight + 4) + 'px';
      });
      div.addEventListener('mouseleave', function () {
        tooltip.classList.remove('show');
      });
    }

    container.appendChild(div);

    for (let i = 0; i < node.children.length; i++) {
      renderNode(node.children[i]);
    }
  }

  function markSectionGaps(nodes) {
    const depthOneFolders = nodes.filter(function (n) {
      return n.depth === 1 && n.isFolder;
    });
    depthOneFolders.forEach(function (node, index) {
      if (index > 0) node.sectionGap = true;
    });
  }

  function renderTree() {
    container.innerHTML = '';
    hierarchy.forEach(function (node) {
      renderNode(node);
    });
    updateTreeVisibility();
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
      detailPath.textContent = 'ansible/' + node.sampleId;
      detailCode.textContent = sample.content;
      detailCode.className = 'language-' + sample.language;

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

  container.addEventListener('click', function (event) {
    const chevron = event.target.closest('.tree-chevron');
    if (chevron) {
      event.preventDefault();
      event.stopPropagation();
      toggleExpand(chevron.dataset.nodeId);
      return;
    }

    const row = event.target.closest('.tree-line.clickable');
    if (!row) return;

    const node = nodeById.get(row.dataset.nodeId);
    if (!node || !node.info) return;

    if (node.isFolder && node.children.length > 0) {
      toggleExpand(node.id);
    }

    selectItem(node, row);
  });

  copyBtn.addEventListener('click', async function () {
    const text = detailCode.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(function () {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      copyBtn.textContent = 'Failed';
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') clearSelection();
  });

  if (expandAllBtn) expandAllBtn.addEventListener('click', expandAll);
  if (collapseAllBtn) collapseAllBtn.addEventListener('click', collapseAll);

  if (hierarchy[0] && hierarchy[0].children) {
    markSectionGaps(hierarchy[0].children);
  }
  initExpandedAll();
  renderTree();
})();
