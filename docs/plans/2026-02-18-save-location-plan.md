# Save Location Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-save the inspector's current folder location to localStorage so they can resume without re-navigating.

**Architecture:** On each target folder detection, save breadcrumbs + target state to localStorage with a timestamp. On app load, check for a non-expired (<10h) saved location and show a "continue" card instead of loading the project list. Tapping "continue" restores state and verifies the folder still exists via webhook. Tapping "choose different" loads the normal flow.

**Tech Stack:** Vanilla JS, localStorage, existing webhook API

---

### Task 1: Add saved-location HTML section

**Files:**
- Modify: `index.html:22` (insert before nav-bar)

**Step 1: Add the saved-location card markup**

Insert after `<main class="main">` (line 22) and before the nav-bar div:

```html
<!-- Saved location -->
<div id="saved-location" class="saved-location" hidden>
    <div class="saved-location__card">
        <div class="saved-location__icon">📁</div>
        <div class="saved-location__info">
            <p class="saved-location__label">המשך העלאה אל:</p>
            <p id="saved-location-path" class="saved-location__path"></p>
        </div>
    </div>
    <button id="saved-location-btn" class="btn btn--primary saved-location__btn" type="button">המשך</button>
    <button id="saved-location-change" class="saved-location__change" type="button">בחר תיקיה אחרת</button>
</div>
```

**Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add saved-location HTML section"
```

---

### Task 2: Add saved-location CSS styles

**Files:**
- Modify: `css/style.css` (insert before Target Folder section, around line 466)

**Step 1: Add styles**

Insert before the `/* Target Folder */` comment block:

```css
/* ============================================
   Saved Location
   ============================================ */
.saved-location {
    background: var(--card);
    border: 2px solid var(--primary);
    border-radius: var(--radius);
    padding: 1.25rem;
    margin-bottom: 1rem;
    animation: slideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow);
}

.saved-location__card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.saved-location__icon {
    font-size: 1.75rem;
    flex-shrink: 0;
    line-height: 1;
}

.saved-location__info {
    flex: 1;
    min-width: 0;
}

.saved-location__label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
    font-weight: 500;
}

.saved-location__path {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text);
    word-break: break-word;
    direction: ltr;
    unicode-bidi: plaintext;
}

.saved-location__btn {
    width: 100%;
    margin-bottom: 0.75rem;
}

.saved-location__change {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.5rem;
    text-decoration: underline;
    text-underline-offset: 2px;
}

.saved-location__change:active {
    color: var(--primary);
}
```

**Step 2: Commit**

```bash
git add css/style.css
git commit -m "style: add saved-location card styles"
```

---

### Task 3: Add localStorage save/load functions in app.js

**Files:**
- Modify: `js/app.js`

**Step 1: Add constants and DOM refs**

Add to Constants section (after line 10):
```js
var STORAGE_KEY = 'nisim_saved_location';
var STORAGE_TTL = 10 * 60 * 60 * 1000; // 10 hours
```

Add to DOM References (after `visitError` line 62):
```js
savedLocation: document.getElementById('saved-location'),
savedLocationPath: document.getElementById('saved-location-path'),
savedLocationBtn: document.getElementById('saved-location-btn'),
savedLocationChange: document.getElementById('saved-location-change'),
```

**Step 2: Add saveLocation function**

Add after the `uploadFile` function (after line 133), in a new section:

```js
// ============================================
// Location Persistence
// ============================================
function saveLocation() {
    var data = {
        breadcrumbs: state.breadcrumbs,
        targetFolder: state.targetFolder,
        targetFolderExists: state.targetFolderExists,
        savedAt: Date.now(),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Storage full or unavailable — silently ignore
    }
}

function loadSavedLocation() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (Date.now() - data.savedAt > STORAGE_TTL) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
}

function clearSavedLocation() {
    localStorage.removeItem(STORAGE_KEY);
}
```

**Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add localStorage save/load/clear functions"
```

---

### Task 4: Wire up save calls and restore flow

**Files:**
- Modify: `js/app.js`

**Step 1: Add save call in showTargetFolder**

In `showTargetFolder()` (around line 393), right after `dom.targetFolder.hidden = false;`, add:

```js
saveLocation();
```

This auto-saves whenever a target folder is detected.

**Step 2: Modify loadRoot to check for saved location**

Replace the `loadRoot()` function with:

```js
function loadRoot() {
    state.breadcrumbs = [{ name: ROOT_NAME, id: 'root' }];
    state.pendingAutoChecks = [];
    state.autoMessages = [];
    state.targetFolder = null;
    state.searchQuery = '';
    dom.searchInput.value = '';

    // Check for saved location
    var saved = loadSavedLocation();
    if (saved && saved.breadcrumbs && saved.breadcrumbs.length > 1) {
        showSavedLocationCard(saved);
        return;
    }

    fetchAndDisplay('root');
}
```

**Step 3: Add showSavedLocationCard and restoreSavedLocation functions**

Add after `clearSavedLocation`:

```js
function showSavedLocationCard(saved) {
    var path = saved.breadcrumbs.map(function (b) { return b.name; }).join(' / ');
    if (saved.targetFolder && saved.targetFolder.name) {
        path += ' / ' + saved.targetFolder.name;
    }
    dom.savedLocationPath.textContent = path;
    dom.savedLocation.hidden = false;

    // Hide everything else
    dom.navBar.hidden = true;
    dom.searchBox.hidden = true;
    dom.folderList.innerHTML = '';
    dom.loading.hidden = true;
    dom.error.hidden = true;
    dom.empty.hidden = true;
    dom.targetFolder.hidden = true;
    dom.uploadSection.hidden = true;
    dom.createVisit.hidden = true;
    dom.autoMsg.hidden = true;
}

function restoreSavedLocation(saved) {
    dom.savedLocation.hidden = true;
    state.breadcrumbs = saved.breadcrumbs;
    state.targetFolder = saved.targetFolder;
    state.targetFolderExists = saved.targetFolderExists;
    state.pendingAutoChecks = [];
    state.autoMessages = [];
    state.searchQuery = '';

    // Fetch the last breadcrumb folder to verify it still exists
    var lastCrumb = state.breadcrumbs[state.breadcrumbs.length - 1];
    fetchAndDisplay(lastCrumb.id);
}
```

**Step 4: Add event listeners for the saved-location buttons**

Add in the Event Handlers section (before `loadRoot()` call at the end):

```js
dom.savedLocationBtn.addEventListener('click', function () {
    var saved = loadSavedLocation();
    if (saved) {
        restoreSavedLocation(saved);
    } else {
        dom.savedLocation.hidden = true;
        fetchAndDisplay('root');
    }
});

dom.savedLocationChange.addEventListener('click', function () {
    dom.savedLocation.hidden = true;
    fetchAndDisplay('root');
});
```

**Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat: wire up save-on-target and restore-on-load flow"
```

---

### Task 5: Manual test and deploy

**Step 1: Test locally**

Open `index.html` in browser. Navigate to a project with a visit/תמונות folder. Check localStorage in DevTools to verify `nisim_saved_location` was saved. Reload the page — should see the saved location card.

**Step 2: Test "choose different"**

Click "בחר תיקיה אחרת" — should dismiss card and load the project list.

**Step 3: Test restore**

Reload page, click "המשך" — should restore breadcrumbs and navigate to the saved folder.

**Step 4: Deploy**

```bash
npx wrangler pages deploy /Users/talorbach/Code/NisimBakara --project-name nisim-bakara
```
