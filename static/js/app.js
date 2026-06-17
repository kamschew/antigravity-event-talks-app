// Global application state
let appState = {
    allEntries: [],
    filteredEntries: [],
    selectedUpdate: null,
    currentTemplate: 'tech', // 'tech', 'news', 'short'
    theme: 'dark'
};

// DOM Elements
const feedContainer = document.getElementById('feed-container');
const refreshBtn = document.getElementById('refresh-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');
const lastUpdatedText = document.getElementById('last-updated-text');
const statusDot = document.getElementById('status-dot');
const searchInput = document.getElementById('search-input');
const filterPills = document.querySelectorAll('.filter-pill');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Composer DOM Elements
const composerBadge = document.getElementById('composer-badge');
const composerInstructions = document.getElementById('composer-instructions');
const composerEditorSection = document.getElementById('composer-editor-section');
const tweetTextarea = document.getElementById('tweet-textarea');
const charRadialBar = document.getElementById('char-radial-bar');
const charCountText = document.getElementById('char-count-text');
const charWarningText = document.getElementById('char-warning-text');
const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
const templateButtons = document.querySelectorAll('.template-btn');

// Stats DOM Elements
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statAnnouncements = document.getElementById('stat-announcements');
const statIssues = document.getElementById('stat-issues');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchFeed();
    setupEventListeners();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    appState.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark') {
        themeToggleDarkIcon.style.display = 'none';
        themeToggleLightIcon.style.display = 'block';
    } else {
        themeToggleDarkIcon.style.display = 'block';
        themeToggleLightIcon.style.display = 'none';
    }
}

function toggleTheme() {
    const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Event Listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => fetchFeed(true));
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Search filter input
    searchInput.addEventListener('input', debounce(() => {
        applyFiltersAndRender();
    }, 250));
    
    // Type Filter Pills
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(p => p.classList.remove('active'));
            e.currentTarget.classList.add('active');
            applyFiltersAndRender();
        });
    });
    
    // Tweet Composer input
    tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
    });
    
    // Tweet Template Buttons
    templateButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            templateButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            appState.currentTemplate = e.currentTarget.dataset.template;
            generateTweetDraft();
        });
    });
    
    // Tweet Share Action
    tweetSubmitBtn.addEventListener('click', publishTweet);
    
    // Export CSV Action
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportToCSV);
    }
}

// Fetch Feed API
async function fetchFeed(forceRefresh = false) {
    // Show spinner
    feedContainer.innerHTML = `
        <div class="spinner-wrapper">
            <div class="spinner"></div>
            <p>${forceRefresh ? 'Refreshing feed from Google Cloud...' : 'Fetching release notes...'}</p>
        </div>
    `;
    
    statusDot.classList.add('syncing');
    lastUpdatedText.querySelector('span:last-child').textContent = 'Syncing...';
    refreshBtn.disabled = true;
    
    try {
        const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.status === 'success') {
            appState.allEntries = result.data;
            
            // Format last updated time
            const updateDate = new Date(result.last_updated * 1000);
            const timeStr = updateDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            lastUpdatedText.querySelector('span:last-child').textContent = `Updated at ${timeStr}`;
            
            calculateStats();
            applyFiltersAndRender();
        } else {
            showErrorState(result.message || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showErrorState('Network error while fetching feed. Please try again.');
    } finally {
        statusDot.classList.remove('syncing');
        refreshBtn.disabled = false;
    }
}

// Show Error UI
function showErrorState(message) {
    feedContainer.innerHTML = `
        <div class="empty-state animate-fade-in" style="border-color: var(--badge-deprecated-border);">
            <p style="color: var(--badge-deprecated); font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">⚠️ Error Loading Feed</p>
            <p>${message}</p>
            <button class="btn btn-outline" style="margin-top: 1rem;" onclick="fetchFeed(true)">Try Again</button>
        </div>
    `;
    lastUpdatedText.querySelector('span:last-child').textContent = 'Failed to sync';
}

// Calculate Summary Stats
function calculateStats() {
    let total = 0;
    let features = 0;
    let announcements = 0;
    let issues = 0;
    
    // We only take the top 100 updates to compile summary stats
    let noteCount = 0;
    for (const entry of appState.allEntries) {
        for (const update of entry.updates) {
            noteCount++;
            if (noteCount > 100) break;
            
            total++;
            const type = update.type.toLowerCase();
            if (type === 'feature') features++;
            else if (type === 'announcement') announcements++;
            else if (type === 'issue' || type === 'deprecation' || type === 'deprecated') issues++;
        }
        if (noteCount > 100) break;
    }
    
    statTotal.textContent = total;
    statFeatures.textContent = features;
    statAnnouncements.textContent = announcements;
    statIssues.textContent = issues;
}

// Filter and Search Logic
function applyFiltersAndRender() {
    const searchQuery = searchInput.value.trim().toLowerCase();
    const activePill = document.querySelector('.filter-pill.active');
    const selectedType = activePill ? activePill.dataset.type : 'all';
    
    const filtered = [];
    
    appState.allEntries.forEach(entry => {
        const matchingUpdates = entry.updates.filter(update => {
            // 1. Type Match
            const matchesType = (selectedType === 'all') || 
                                (selectedType === 'Deprecated' && (update.type === 'Deprecated' || update.type === 'Deprecation')) ||
                                (update.type.toLowerCase() === selectedType.toLowerCase());
            
            // 2. Keyword Match (in content or type)
            const matchesKeyword = !searchQuery || 
                                   update.plain_text.toLowerCase().includes(searchQuery) ||
                                   update.type.toLowerCase().includes(searchQuery) ||
                                   entry.date.toLowerCase().includes(searchQuery);
                                   
            return matchesType && matchesKeyword;
        });
        
        if (matchingUpdates.length > 0) {
            filtered.push({
                ...entry,
                updates: matchingUpdates
            });
        }
    });
    
    appState.filteredEntries = filtered;
    renderFeed();
}

// Render Feed items to DOM
function renderFeed() {
    if (appState.filteredEntries.length === 0) {
        feedContainer.innerHTML = `
            <div class="empty-state animate-fade-in">
                <p style="font-weight: 500; font-size: 1.1rem; margin-bottom: 0.5rem;">🔍 No updates found</p>
                <p>Try adjusting your search keywords or type filters.</p>
            </div>
        `;
        return;
    }
    
    feedContainer.innerHTML = '';
    
    appState.filteredEntries.forEach(entry => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group animate-fade-in';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.innerHTML = `
            <div class="date-badge">${entry.date}</div>
            <div class="date-line"></div>
        `;
        dateGroup.appendChild(dateHeader);
        
        entry.updates.forEach((update, idx) => {
            const cardId = `${entry.id}-${idx}`;
            const isSelected = appState.selectedUpdate && appState.selectedUpdate.cardId === cardId;
            
            const card = document.createElement('div');
            card.className = `release-card ${isSelected ? 'selected' : ''}`;
            card.id = `card-${cardId}`;
            
            const typeClass = update.type.toLowerCase();
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="badge-wrapper">
                        <span class="type-badge ${typeClass}">${update.type}</span>
                    </div>
                    <div class="select-container" onclick="event.stopPropagation(); selectUpdate('${cardId}', '${entry.date}', ${JSON.stringify(update.type).replace(/"/g, '&quot;')}, ${JSON.stringify(update.plain_text).replace(/"/g, '&quot;')}, '${entry.link}')">
                        <span class="checkbox-custom">
                            ${isSelected ? '✓' : ''}
                        </span>
                    </div>
                </div>
                <div class="card-body">
                    ${update.content_html}
                </div>
                <div class="card-actions">
                    <div class="card-actions-left">
                        <button class="card-action-btn select-btn" onclick="selectUpdate('${cardId}', '${entry.date}', ${JSON.stringify(update.type).replace(/"/g, '&quot;')}, ${JSON.stringify(update.plain_text).replace(/"/g, '&quot;')}, '${entry.link}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
                            </svg>
                            <span>${isSelected ? 'Selected' : 'Select to Tweet'}</span>
                        </button>
                        <button class="card-action-btn tweet-btn-direct" onclick="event.stopPropagation(); directTweet('${entry.date}', ${JSON.stringify(update.type).replace(/"/g, '&quot;')}, ${JSON.stringify(update.plain_text).replace(/"/g, '&quot;')}, '${entry.link}')" title="Tweet directly">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            <span>Quick Tweet</span>
                        </button>
                        <button class="card-action-btn copy-btn" onclick="event.stopPropagation(); copyToClipboard(${JSON.stringify(update.plain_text).replace(/"/g, '&quot;')}, this)">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                            </svg>
                            <span>Copy</span>
                        </button>
                    </div>
                    <a href="${entry.link}" class="card-source-link" target="_blank" rel="noopener noreferrer">
                        <span>Source Doc</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </div>
            `;
            dateGroup.appendChild(card);
        });
        
        feedContainer.appendChild(dateGroup);
    });
}

// Select a release note update to load into the composer
function selectUpdate(cardId, date, type, plainText, link) {
    const activeCard = document.getElementById(`card-${cardId}`);
    
    // Toggle check
    if (appState.selectedUpdate && appState.selectedUpdate.cardId === cardId) {
        // Deselect
        appState.selectedUpdate = null;
        if (activeCard) activeCard.classList.remove('selected');
        
        // Hide Composer Editor, show instructions
        composerBadge.textContent = 'No update selected';
        composerInstructions.style.display = 'block';
        composerEditorSection.style.display = 'none';
        
        // Re-render feed items to update all Select buttons correctly
        renderFeed();
    } else {
        // Remove selection from previous
        if (appState.selectedUpdate) {
            const prevCard = document.getElementById(`card-${appState.selectedUpdate.cardId}`);
            if (prevCard) prevCard.classList.remove('selected');
        }
        
        appState.selectedUpdate = { cardId, date, type, plainText, link };
        if (activeCard) activeCard.classList.add('selected');
        
        // Show Composer Editor, hide instructions
        composerBadge.textContent = `${type} (${date})`;
        composerInstructions.style.display = 'none';
        composerEditorSection.style.display = 'flex';
        
        generateTweetDraft();
        
        // Re-render feed items to update select checkmarks/buttons
        renderFeed();
        
        // Scroll slightly on mobile to show composer if stacked
        if (window.innerWidth <= 1024) {
            composerInstructions.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

// Twitter URL counting implementation (Twitter treats links as 23 characters)
function calculateTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    // Replace all URLs with a dummy string of 23 characters
    const textWithShortUrls = text.replace(urlRegex, "".padEnd(23, "x"));
    return textWithShortUrls.length;
}

// Helper to truncate text to fit the Tweet Composer
function truncateBodyText(bodyText, maxBodyLen) {
    if (bodyText.length <= maxBodyLen) {
        return bodyText;
    }
    return bodyText.substring(0, maxBodyLen - 3) + '...';
}

// Generate the Tweet Draft using the current template and selected update
function generateTweetDraft() {
    if (!appState.selectedUpdate) return;
    
    const { date, type, plainText, link } = appState.selectedUpdate;
    
    // Standardize spacing and strip newlines in body text
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    
    let draft = '';
    
    // Construct the templates with placeholder body text and truncate body to fit 280
    if (appState.currentTemplate === 'tech') {
        const prefix = `🚀 New #BigQuery ${type} (${date}):\n`;
        const suffix = `\n\nRead more: ${link} #GCP #DataAnalytics`;
        
        // Estimate lengths
        // Note: Twitter URLs count as 23. Link length here is link.length, we replace it with 23 for limit estimation.
        const staticLen = calculateTwitterLength(prefix + suffix);
        const maxBodyLen = 280 - staticLen;
        const truncatedBody = truncateBodyText(cleanText, maxBodyLen);
        
        draft = prefix + truncatedBody + suffix;
        
    } else if (appState.currentTemplate === 'news') {
        const prefix = `📢 BigQuery Release Note (${date})\nType: ${type}\n\n`;
        const suffix = `\n\nFull details: ${link} #GoogleCloud #BigQuery`;
        
        const staticLen = calculateTwitterLength(prefix + suffix);
        const maxBodyLen = 280 - staticLen;
        const truncatedBody = truncateBodyText(cleanText, maxBodyLen);
        
        draft = prefix + truncatedBody + suffix;
        
    } else if (appState.currentTemplate === 'short') {
        const prefix = `⚡ #BigQuery ${type}: `;
        const suffix = ` ${link}`;
        
        const staticLen = calculateTwitterLength(prefix + suffix);
        const maxBodyLen = 280 - staticLen;
        const truncatedBody = truncateBodyText(cleanText, maxBodyLen);
        
        draft = prefix + truncatedBody + suffix;
    }
    
    tweetTextarea.value = draft;
    updateCharCounter();
}

// Character counter layout updates
function updateCharCounter() {
    const text = tweetTextarea.value;
    const tweetLen = calculateTwitterLength(text);
    
    charCountText.textContent = `${tweetLen} / 280 characters`;
    
    // Calculate progress percentage
    const progressPercent = Math.min((tweetLen / 280) * 100, 100);
    charRadialBar.style.setProperty('--progress-percent', progressPercent);
    
    // Visual indicators for constraints
    charCountText.className = '';
    charWarningText.style.display = 'none';
    tweetSubmitBtn.disabled = false;
    
    if (tweetLen > 280) {
        charCountText.classList.add('error');
        document.getElementById('char-counter-row').className = 'char-counter-row error';
        charWarningText.style.display = 'inline';
        charWarningText.textContent = `Over limit by ${tweetLen - 280} char${tweetLen - 280 > 1 ? 's' : ''}!`;
        tweetSubmitBtn.disabled = true;
    } else if (tweetLen >= 250) {
        document.getElementById('char-counter-row').className = 'char-counter-row warning';
    } else {
        document.getElementById('char-counter-row').className = 'char-counter-row';
    }
}

// Helper to open Twitter intent
function publishTweet() {
    const text = tweetTextarea.value;
    const tweetLen = calculateTwitterLength(text);
    
    if (tweetLen > 280) {
        alert('Tweet exceeds the 280 character limit. Please shorten it before posting.');
        return;
    }
    
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterIntentUrl, '_blank', 'width=550,height=420');
}

// Direct quick tweet button action on individual cards
function directTweet(date, type, plainText, link) {
    const cleanText = plainText.replace(/\s+/g, ' ').trim();
    const prefix = `🚀 #BigQuery ${type} (${date}): `;
    const suffix = ` ${link}`;
    
    const staticLen = calculateTwitterLength(prefix + suffix);
    const maxBodyLen = 280 - staticLen;
    const truncatedBody = truncateBodyText(cleanText, maxBodyLen);
    
    const finalTweet = prefix + truncatedBody + suffix;
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(finalTweet)}`;
    window.open(twitterIntentUrl, '_blank', 'width=550,height=420');
}

// Copy to clipboard helper
function copyToClipboard(text, buttonEl) {
    navigator.clipboard.writeText(text).then(() => {
        const span = buttonEl.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Copied!';
        buttonEl.style.color = 'var(--badge-feature)';
        
        setTimeout(() => {
            span.textContent = originalText;
            buttonEl.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy to clipboard', err);
    });
}

// Utility: Debounce function for input events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Export to CSV helper function
function exportToCSV() {
    if (appState.filteredEntries.length === 0) {
        alert('No updates found to export.');
        return;
    }
    
    const rows = [['Date', 'Type', 'Content', 'Link']];
    
    appState.filteredEntries.forEach(entry => {
        entry.updates.forEach(update => {
            rows.push([
                entry.date,
                update.type,
                update.plain_text.replace(/\s+/g, ' ').trim(),
                entry.link
            ]);
        });
    });
    
    // Format rows into CSV string
    const csvString = rows.map(row => 
        row.map(value => {
            const escaped = ('' + value).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(',')
    ).join('\r\n');
    
    // Create Blob and trigger download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, 'bigquery_release_notes.csv');
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
