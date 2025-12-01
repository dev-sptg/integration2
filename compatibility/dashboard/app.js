// Aleo Compatibility Matrix Dashboard

const MATRIX_URL = 'matrix.json';
const VERSIONS_URL = 'versions.json';

class CompatibilityDashboard {
  constructor() {
    this.matrixData = null;
    this.versionsConfig = null;
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.renderStats();
      this.renderMatrix();
      this.renderHistory();
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

  renderMatrix() {
    const results = this.matrixData.results || [];
    
    // Extract unique versions
    const snarkosVersions = [...new Set(results.map(r => r.snarkos_version))].sort(this.versionSort);
    const sdkVersions = [...new Set(results.map(r => r.sdk_version))].sort(this.versionSort);

    if (snarkosVersions.length === 0 || sdkVersions.length === 0) {
      this.renderEmptyMatrix();
      return;
    }

    // Build lookup map
    const resultMap = new Map();
    results.forEach(r => {
      resultMap.set(`${r.snarkos_version}|${r.sdk_version}`, r);
    });

    // Render table
    const table = document.getElementById('matrix-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    // Clear existing
    thead.innerHTML = '<th class="corner-cell">snarkOS \\ SDK</th>';
    tbody.innerHTML = '';

    // Add SDK version headers
    sdkVersions.forEach(sdk => {
      const th = document.createElement('th');
      th.textContent = sdk;
      thead.appendChild(th);
    });

    // Add rows for each snarkOS version
    snarkosVersions.forEach(snarkos => {
      const tr = document.createElement('tr');
      
      // Row header
      const th = document.createElement('th');
      th.textContent = snarkos;
      tr.appendChild(th);

      // Cells for each SDK version
      sdkVersions.forEach(sdk => {
        const td = document.createElement('td');
        const result = resultMap.get(`${snarkos}|${sdk}`);
        
        if (result) {
          td.className = result.result;
          td.textContent = result.result === 'pass' ? '✓' : result.result === 'fail' ? '✗' : '?';
          td.title = `snarkOS ${snarkos} + SDK ${sdk}\nResult: ${result.result}\nTested: ${this.formatDate(result.timestamp)}`;
        } else {
          td.className = 'unknown';
          td.textContent = '·';
          td.title = `snarkOS ${snarkos} + SDK ${sdk}\nNot tested`;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  renderEmptyMatrix() {
    const tbody = document.querySelector('#matrix-table tbody');
    tbody.innerHTML = `
      <tr>
        <td colspan="100" class="unknown" style="padding: 2rem;">
          No test results yet. Run the compatibility matrix workflow to generate data.
        </td>
      </tr>
    `;
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

    historyList.innerHTML = sortedResults.map(result => `
      <div class="history-item">
        <div class="history-status ${result.result}"></div>
        <div class="history-versions">
          snarkOS <strong>${result.snarkos_version}</strong>
          <span>×</span>
          SDK <strong>${result.sdk_version}</strong>
        </div>
        <div class="history-result ${result.result}">${result.result}</div>
        <div class="history-time">${this.formatDate(result.timestamp)}</div>
      </div>
    `).join('');
  }

  showError() {
    document.getElementById('history-list').innerHTML = `
      <div class="loading" style="color: var(--fail);">
        Failed to load compatibility data. Make sure matrix.json exists.
      </div>
    `;
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

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CompatibilityDashboard();
});

