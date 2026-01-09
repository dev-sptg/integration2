// Aleo Compatibility Matrix Dashboard

const MATRIX_URL = 'matrix.json';
const VERSIONS_URL = 'versions.json';

class CompatibilityDashboard {
  constructor() {
    this.matrixData = null;
    this.versionsConfig = null;
    this.components = {};
    this.primaryAxes = [];
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.parseConfig();
      this.renderStats();
      this.renderMatrices();
      this.renderHistory();
      this.updateSubtitle();
      this.updateFooterLinks();
    } catch (error) {
      console.error('Failed to load compatibility data:', error);
      this.showError();
    }
  }

  async loadData() {
    const [matrixResponse, versionsResponse] = await Promise.all([
      fetch(MATRIX_URL),
      fetch(VERSIONS_URL).catch(() => null)
    ]);

    if (!matrixResponse.ok) {
      throw new Error('Failed to load matrix data');
    }

    this.matrixData = await matrixResponse.json();
    
    if (versionsResponse?.ok) {
      this.versionsConfig = await versionsResponse.json();
    } else {
      throw new Error('Failed to load versions config');
    }
  }

  parseConfig() {
    if (!this.versionsConfig?.components) {
      throw new Error('Invalid versions config: missing components');
    }

    this.components = this.versionsConfig.components;
    this.primaryAxes = this.versionsConfig.matrix_config?.primary_axes || ['snarkos', 'sdk'];
    
    // Validate primary axes exist
    for (const axis of this.primaryAxes) {
      if (!this.components[axis]) {
        console.warn(`Primary axis component '${axis}' not found in components config`);
      }
    }
  }

  renderStats() {
    const results = this.matrixData.results || [];
    const passCount = results.filter(r => r.result === 'pass').length;
    const failCount = results.filter(r => r.result === 'fail').length;

    document.getElementById('total-tests').textContent = results.length;
    document.getElementById('pass-count').textContent = passCount;
    document.getElementById('fail-count').textContent = failCount;

    const lastUpdated = this.matrixData.last_updated;
    if (lastUpdated) {
      const date = new Date(lastUpdated);
      document.getElementById('last-updated').textContent = this.formatRelativeTime(date);
    } else {
      document.getElementById('last-updated').textContent = 'Never';
    }
  }

  renderMatrices() {
    const results = this.matrixData.results || [];
    const container = document.getElementById('matrices-container');
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="matrix-container">
          <div class="matrix-header">
            <h2>Version Matrix</h2>
          </div>
          <div class="matrix-scroll">
            <div class="unknown" style="padding: 2rem; text-align: center;">
              No test results yet. Run the compatibility matrix workflow to generate data.
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Get all component keys from results
    const allComponentKeys = new Set();
    results.forEach(r => {
      Object.keys(r).forEach(key => {
        if (key !== 'result' && key !== 'timestamp' && r[key]) {
          allComponentKeys.add(key.replace('_version', ''));
        }
      });
    });

    // Determine grouping dimensions (non-primary axes)
    const groupingDims = Array.from(allComponentKeys).filter(
      key => !this.primaryAxes.includes(key)
    );

    // Group results by non-axis dimensions
    const groupedResults = this.groupResults(results, groupingDims);

    // Render matrices
    container.innerHTML = '';
    
    if (groupingDims.length === 0) {
      // No grouping needed - single matrix
      this.renderSingleMatrix(results, container, null);
    } else {
      // Render one matrix per group
      const sortedGroups = Array.from(groupedResults.entries()).sort((a, b) => {
        // Sort by group key (e.g., DPS version)
        return this.versionSort(a[0], b[0]);
      });

      sortedGroups.forEach(([groupKey, groupResults]) => {
        this.renderSingleMatrix(groupResults, container, groupKey, groupingDims);
      });
    }
  }

  groupResults(results, groupingDims) {
    const groups = new Map();

    results.forEach(result => {
      // Build group key from grouping dimensions
      const groupParts = groupingDims.map(dim => {
        const versionKey = `${dim}_version`;
        const version = result[versionKey];
        // Treat missing, null, or empty versions as 'all' (no filtering)
        if (!version || version === 'null' || version === 'undefined' || version.trim() === '') {
          return 'all';
        }
        return version;
      });
      const groupKey = groupParts.join(' | ');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(result);
    });

    return groups;
  }

  renderSingleMatrix(results, container, groupLabel, groupingDims) {
    const [axis1, axis2] = this.primaryAxes;
    const axis1Key = `${axis1}_version`;
    const axis2Key = `${axis2}_version`;

    // Extract unique versions for each axis
    const axis1Versions = [...new Set(results.map(r => r[axis1Key]).filter(Boolean))].sort(this.versionSort);
    const axis2Versions = [...new Set(results.map(r => r[axis2Key]).filter(Boolean))].sort(this.versionSort);

    if (axis1Versions.length === 0 || axis2Versions.length === 0) {
      return;
    }

    // Build lookup map
    const resultMap = new Map();
    results.forEach(r => {
      const key = `${r[axis1Key]}|${r[axis2Key]}`;
      resultMap.set(key, r);
    });

    // Create matrix container
    const matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';

    // Matrix header with group label
    const header = document.createElement('div');
    header.className = 'matrix-header';
    
    const title = document.createElement('h2');
    if (groupLabel && groupLabel !== 'all | all') {
      // Format group label nicely (e.g., "DPS v0.17.0")
      const groupParts = groupLabel.split(' | ');
      const formattedLabels = groupingDims.map((dim, idx) => {
        const component = this.components[dim];
        const label = component?.label || dim.toUpperCase();
        return `${label} ${groupParts[idx]}`;
      });
      title.textContent = formattedLabels.join(' × ');
    } else {
      title.textContent = 'Version Matrix';
    }
    
    header.appendChild(title);
    
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend-item"><span class="dot pass"></span> Compatible</span>
      <span class="legend-item"><span class="dot fail"></span> Incompatible</span>
      <span class="legend-item"><span class="dot unknown"></span> Not Tested</span>
    `;
    header.appendChild(legend);
    matrixContainer.appendChild(header);

    // Matrix scroll container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'matrix-scroll';

    // Create table
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Header row
    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.className = 'corner-cell';
    const axis1Label = this.components[axis1]?.label || axis1.toUpperCase();
    const axis2Label = this.components[axis2]?.label || axis2.toUpperCase();
    cornerCell.textContent = `${axis1Label} \\ ${axis2Label}`;
    headerRow.appendChild(cornerCell);

    // Add axis2 version headers
    axis2Versions.forEach(version => {
      const th = document.createElement('th');
      th.textContent = version;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Add rows for each axis1 version
    axis1Versions.forEach(axis1Version => {
      const tr = document.createElement('tr');
      
      // Row header
      const th = document.createElement('th');
      th.textContent = axis1Version;
      tr.appendChild(th);

      // Cells for each axis2 version
      axis2Versions.forEach(axis2Version => {
        const td = document.createElement('td');
        const result = resultMap.get(`${axis1Version}|${axis2Version}`);
        
        if (result) {
          td.className = result.result;
          td.textContent = result.result === 'pass' ? '✓' : result.result === 'fail' ? '✗' : '?';
          
          // Build tooltip with all component versions
          const tooltipParts = [`${axis1Label} ${axis1Version}`, `${axis2Label} ${axis2Version}`];
          groupingDims.forEach(dim => {
            const versionKey = `${dim}_version`;
            const version = result[versionKey];
            if (version && version !== 'null' && version !== 'undefined' && version.trim() !== '') {
              const dimLabel = this.components[dim]?.label || dim.toUpperCase();
              tooltipParts.push(`${dimLabel} ${version}`);
            }
          });
          tooltipParts.push(`Result: ${result.result}`, `Tested: ${this.formatDate(result.timestamp)}`);
          td.title = tooltipParts.join('\n');
        } else {
          td.className = 'unknown';
          td.textContent = '·';
          td.title = `${axis1Label} ${axis1Version} + ${axis2Label} ${axis2Version}\nNot tested`;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    scrollContainer.appendChild(table);
    matrixContainer.appendChild(scrollContainer);
    container.appendChild(matrixContainer);
  }

  renderHistory() {
    const historyList = document.getElementById('history-list');
    const results = this.matrixData.results || [];

    if (results.length === 0) {
      historyList.innerHTML = '<div class="loading">No test results available</div>';
      return;
    }

    // Sort by timestamp (newest first)
    const sortedResults = [...results].sort((a, b) => {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    historyList.innerHTML = sortedResults.map((result, index) => {
      // Build component version badges dynamically
      const componentBadges = [];
      
      // Add all component versions (only if they exist and are not null/empty)
      Object.keys(this.components).forEach(componentKey => {
        const versionKey = `${componentKey}_version`;
        const version = result[versionKey];
        if (version && version !== 'null' && version !== 'undefined' && version.trim() !== '') {
          const component = this.components[componentKey];
          const label = component?.label || componentKey.toUpperCase();
          componentBadges.push(`${label} <strong>${version}</strong>`);
        }
      });

      // Build test details HTML
      const tests = result.tests || [];
      const hasTests = tests.length > 0;
      const testsHtml = hasTests ? this.renderTestDetails(tests) : '';

      return `
        <div class="history-entry ${hasTests ? 'expandable' : ''}" data-index="${index}">
          <div class="history-item" ${hasTests ? `onclick="toggleTestDetails(${index})"` : ''}>
            <div class="history-status ${result.result}"></div>
            <div class="history-versions">
              ${componentBadges.join('<span> × </span>')}
            </div>
            <div class="history-result ${result.result}">${result.result}</div>
            <div class="history-time">${this.formatDate(result.timestamp)}</div>
            ${hasTests ? '<div class="expand-icon">▼</div>' : ''}
          </div>
          ${hasTests ? `<div class="test-details" id="details-${index}">${testsHtml}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  renderTestDetails(tests) {
    return tests.map(test => {
      const statusIcon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○';
      const statusClass = test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'skipped';
      
      // Render subtests if available
      const subtests = test.subtests || [];
      const subtestsHtml = subtests.length > 0 ? `
        <div class="subtests">
          ${subtests.map(sub => {
            const subIcon = sub.status === 'passed' ? '✓' : sub.status === 'failed' ? '✗' : '○';
            const subClass = sub.status === 'passed' ? 'pass' : sub.status === 'failed' ? 'fail' : 'skipped';
            return `
              <div class="subtest-item">
                <span class="test-icon ${subClass}">${subIcon}</span>
                <span class="test-name">${sub.name}</span>
                <span class="test-duration">${sub.duration || ''}</span>
              </div>
            `;
          }).join('')}
        </div>
      ` : '';
      
      return `
        <div class="test-suite">
          <div class="test-item suite-header">
            <span class="test-icon ${statusClass}">${statusIcon}</span>
            <span class="test-name"><strong>${test.name}</strong></span>
            <span class="test-duration">${test.duration || ''}</span>
          </div>
          ${test.error ? `<div class="test-error">${test.error}</div>` : ''}
          ${subtestsHtml}
        </div>
      `;
    }).join('');
  }

  updateSubtitle() {
    const subtitle = document.querySelector('.subtitle');
    if (subtitle && this.components) {
      const componentLabels = Object.values(this.components).map(c => c.label);
      subtitle.textContent = componentLabels.join(' × ') + ' version compatibility';
    }
  }

  updateFooterLinks() {
    const footerLinks = document.getElementById('footer-links');
    if (footerLinks && this.components) {
      const linksParagraph = footerLinks.querySelector('p');
      if (linksParagraph) {
        const links = [];
        // Add component links
        Object.entries(this.components).forEach(([key, component]) => {
          if (component.repo) {
            const link = document.createElement('a');
            link.href = `https://github.com/${component.repo}`;
            link.target = '_blank';
            link.rel = 'noopener';
            link.textContent = component.label;
            links.push(link);
          }
        });
        // Add Aleo link
        const aleoLink = document.createElement('a');
        aleoLink.href = 'https://aleo.org';
        aleoLink.target = '_blank';
        aleoLink.rel = 'noopener';
        aleoLink.textContent = 'Aleo';
        links.push(aleoLink);
        
        // Clear and rebuild links
        linksParagraph.innerHTML = '';
        links.forEach((link, index) => {
          linksParagraph.appendChild(link);
          if (index < links.length - 1) {
            linksParagraph.appendChild(document.createTextNode(' · '));
          }
        });
      }
    }
  }

  showError() {
    const container = document.getElementById('matrices-container') || document.getElementById('history-list');
    if (container) {
      container.innerHTML = `
        <div class="loading" style="color: var(--fail);">
          Failed to load compatibility data. Make sure matrix.json exists.
        </div>
      `;
    }
  }

  // Version sorting (handles semver-like versions and branches)
  versionSort(a, b) {
    // Put branches (non-v prefixed) at the end
    const aIsTag = a.startsWith('v');
    const bIsTag = b.startsWith('v');
    
    if (aIsTag && !bIsTag) return -1;
    if (!aIsTag && bIsTag) return 1;
    
    // For tags, sort by version number (descending - newest first)
    if (aIsTag && bIsTag) {
      const aParts = a.replace('v', '').split('.').map(Number);
      const bParts = b.replace('v', '').split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return bVal - aVal;
      }
    }
    
    return a.localeCompare(b);
  }

  formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

}

// Global function to toggle test details
function toggleTestDetails(index) {
  const details = document.getElementById(`details-${index}`);
  const entry = details.closest('.history-entry');
  
  if (details.classList.contains('expanded')) {
    details.classList.remove('expanded');
    entry.classList.remove('expanded');
  } else {
    details.classList.add('expanded');
    entry.classList.add('expanded');
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CompatibilityDashboard();
});
