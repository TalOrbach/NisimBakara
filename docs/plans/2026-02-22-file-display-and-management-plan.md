# File Display & Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show files alongside folders in the browser, with thumbnails for images, rename/delete operations, and post-upload cleanup.

**Architecture:** Extend the existing vanilla JS/HTML/CSS app. Three new Make.com webhook scenarios (rename, delete, thumbnail). Files appear in a collapsible section below folders. Thumbnails loaded lazily per-image.

**Tech Stack:** Vanilla JS, Make.com webhooks, Graph API, HTML/CSS

---

### Task 1: Create Make.com Scenarios (Rename, Delete, Thumbnail)

These need to be created via the Make.com API before the frontend can use them.

**Files:**
- No code files — Make.com API calls via browser automation or curl

**Step 1: Create "Rename File" scenario**

Use Make.com API to create a scenario with:
- Custom webhook trigger: receives `{"itemId": "...", "newName": "..."}`
- SharePoint "Make an API Call" module: `PATCH /drive/items/{{2.itemId}}` with body `{"name": "{{2.newName}}"}`, type `text`
- Webhook response module: returns the API response
- Connection ID: `5061517`

API call pattern (same as existing scenarios were created):
```
POST https://eu1.make.com/api/v2/scenarios
Authorization: Token e6650d41-ac1b-420d-8117-75c2abc21eb1
```

**Step 2: Create "Delete File" scenario**

Same pattern:
- Webhook trigger: receives `{"itemId": "..."}`
- SharePoint API call: `DELETE /drive/items/{{2.itemId}}`
- Webhook response: returns `{"success": true}`

**Step 3: Create "Get Thumbnail" scenario**

- Webhook trigger: receives `{"itemId": "..."}`
- SharePoint API call: `GET /drive/items/{{2.itemId}}/thumbnails/0/small/content`
- Webhook response: returns the thumbnail data

Note: The thumbnail endpoint returns binary image data. The webhook response may need to return it as base64, since custom webhooks can't pass binary through. If binary doesn't work, the alternative is to have the Graph API return a redirect URL (`/thumbnails/0/small`) which gives a `url` field we can use directly.

**Step 4: Activate all three scenarios**

POST to `/scenarios/{id}/start` for each.

**Step 5: Test each webhook**

Test rename with the test folder, then verify. Test delete by creating a temp file first. Test thumbnail with a known image.

**Step 6: Commit webhook URLs to constants**

Add the three new webhook URLs to the constants section of `js/app.js`:
```javascript
var RENAME_WEBHOOK = 'https://hook.eu1.make.com/...';
var DELETE_WEBHOOK = 'https://hook.eu1.make.com/...';
var THUMBNAIL_WEBHOOK = 'https://hook.eu1.make.com/...';
```

**Step 7: Commit**
```
feat: add Make.com webhook URLs for rename, delete, and thumbnail
```

---

### Task 2: Fetch and Separate Files from Folders

**Files:**
- Modify: `js/app.js` — `fetchFolders()`, state, `fetchAndDisplay()`

**Step 1: Update state to track files separately**

In `state` object, add:
```javascript
currentFiles: [],       // non-folder items at current level
filesExpanded: false,   // whether files section is open
```

**Step 2: Rename `fetchFolders` to `fetchItems` and stop filtering**

Change the function to return ALL items (not just folders), and split them in `fetchAndDisplay`:
```javascript
function fetchItems(folderId) {
  return fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId: folderId }),
  })
    .then(function (response) {
      if (!response.ok) throw new Error('שגיאת שרת: ' + response.status);
      return response.json();
    })
    .then(function (data) {
      var items = Array.isArray(data) ? data : (data.value || []);
      return items;
    });
}
```

**Step 3: Update `fetchAndDisplay` to separate folders and files**

After receiving items:
```javascript
var folders = items.filter(function (item) { return item.folder; });
var files = items.filter(function (item) { return !item.folder; });
state.currentItems = folders;
state.currentFiles = files;
state.filesExpanded = folders.length === 0; // auto-expand if no subfolders
```

Update all references from `fetchFolders` to `fetchItems`.

**Step 4: Verify existing folder navigation still works**

Open the app, navigate through folders. Folders should display exactly as before. Files are stored in state but not yet rendered.

**Step 5: Commit**
```
refactor: fetch all items (folders + files) from SharePoint
```

---

### Task 3: Add API Functions for Rename, Delete, Thumbnail

**Files:**
- Modify: `js/app.js` — API section

**Step 1: Add `renameFile` function**

```javascript
function renameFile(itemId, newName) {
  return fetch(RENAME_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: itemId, newName: newName }),
  })
    .then(function (response) {
      if (!response.ok) {
        if (response.status === 409) throw new Error('שם קובץ כבר קיים');
        throw new Error('שגיאה בשינוי שם: ' + response.status);
      }
      return response.json();
    });
}
```

**Step 2: Add `deleteFile` function**

```javascript
function deleteFile(itemId) {
  return fetch(DELETE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: itemId }),
  })
    .then(function (response) {
      if (!response.ok) throw new Error('שגיאה במחיקת קובץ: ' + response.status);
      return response.json();
    });
}
```

**Step 3: Add `fetchThumbnail` function**

```javascript
function fetchThumbnail(itemId) {
  return fetch(THUMBNAIL_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId: itemId }),
  })
    .then(function (response) {
      if (!response.ok) throw new Error('שגיאה בטעינת תמונה ממוזערת');
      return response.json();
    });
}
```

Note: The exact response handling depends on how the Make.com thumbnail scenario returns data. May need to adjust to handle base64 or a direct URL.

**Step 4: Commit**
```
feat: add API functions for file rename, delete, and thumbnail
```

---

### Task 4: HTML Structure for Files Section

**Files:**
- Modify: `index.html` — add files section after folder-list

**Step 1: Add files section HTML**

After the `<ul id="folder-list">` and before `<div id="target-folder">`, add:

```html
<!-- Files section (collapsible) -->
<div id="files-section" class="files-section" hidden>
    <button id="files-toggle" class="files-section__toggle" type="button">
        <span id="files-toggle-icon" class="files-section__chevron">◀</span>
        <span id="files-toggle-text">קבצים</span>
    </button>
    <ul id="file-list" class="file-list"></ul>
</div>
```

**Step 2: Add DOM references in `js/app.js`**

```javascript
filesSection: document.getElementById('files-section'),
filesToggle: document.getElementById('files-toggle'),
filesToggleIcon: document.getElementById('files-toggle-icon'),
filesToggleText: document.getElementById('files-toggle-text'),
fileList: document.getElementById('file-list'),
```

**Step 3: Commit**
```
feat: add HTML structure for collapsible files section
```

---

### Task 5: CSS for Files Section and File Cards

**Files:**
- Modify: `css/style.css`

**Step 1: Add files section styles**

```css
/* ============================================
   Files Section (collapsible)
   ============================================ */
.files-section {
    margin-top: 0.75rem;
}

.files-section__toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    transition: all var(--transition);
    box-shadow: var(--shadow-sm);
}

.files-section__toggle:active {
    background: var(--primary-light);
}

.files-section__chevron {
    font-size: 0.625rem;
    transition: transform var(--transition);
    display: inline-block;
}

.files-section__chevron--open {
    transform: rotate(-90deg);
}

.file-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
}
```

**Step 2: Add file card styles**

```css
/* ============================================
   File Card
   ============================================ */
.file-card {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    color: var(--text);
    box-shadow: var(--shadow-sm);
    transition: all var(--transition);
    animation: slideDown 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.file-card__icon {
    font-size: 1.25rem;
    flex-shrink: 0;
    line-height: 1;
}

.file-card__thumb {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    background: var(--border-light);
    box-shadow: var(--shadow-sm);
}

.file-card__thumb--loading {
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.file-card__name {
    flex: 1;
    min-width: 0;
    word-break: break-word;
    font-weight: 500;
    text-align: right;
}

.file-card__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
}

.file-card__action-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background var(--transition);
    color: var(--text-secondary);
}

.file-card__action-btn:active {
    background: var(--primary-light);
}

.file-card__action-btn--danger:active {
    background: var(--error-light);
    color: var(--error);
}
```

**Step 3: Add inline edit mode styles**

```css
/* Inline edit mode */
.file-card__edit-input {
    flex: 1;
    min-width: 0;
    padding: 0.375rem 0.5rem;
    border: 1.5px solid var(--primary);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--text);
    outline: none;
    box-shadow: 0 0 0 3px var(--primary-glow);
    direction: rtl;
}

/* Inline delete confirmation */
.file-card__confirm {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--error);
    font-weight: 500;
}

.file-card__confirm-btn {
    width: 28px;
    height: 28px;
    border: 1.5px solid;
    background: none;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all var(--transition);
}

.file-card__confirm-btn--yes {
    color: var(--error);
    border-color: var(--error);
}

.file-card__confirm-btn--yes:active {
    background: var(--error);
    color: white;
}

.file-card__confirm-btn--no {
    color: var(--text-secondary);
    border-color: var(--border);
}

.file-card__confirm-btn--no:active {
    background: var(--border-light);
}

/* Inline error message */
.file-card__error {
    font-size: 0.75rem;
    color: var(--error);
    font-weight: 500;
    margin-top: 0.25rem;
    padding: 0 1rem;
}

/* Spinner for in-progress operations */
.file-card__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
    flex-shrink: 0;
}
```

**Step 4: Commit**
```
style: add CSS for files section, file cards, and inline edit/delete
```

---

### Task 6: Render Files Section (Basic — No Thumbnails Yet)

**Files:**
- Modify: `js/app.js`

**Step 1: Add file-type icon helper**

```javascript
var FILE_ICONS = {
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', bmp: '🖼️', webp: '🖼️', heic: '🖼️',
  pdf: '📄', doc: '📄', docx: '📄', txt: '📄', rtf: '📄',
  xls: '📊', xlsx: '📊', csv: '📊',
  ppt: '📊', pptx: '📊',
  zip: '📦', rar: '📦', '7z': '📦',
};

function getFileIcon(fileName) {
  var ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

function isImageFile(fileName) {
  var ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic'].indexOf(ext) !== -1;
}
```

**Step 2: Add `renderFiles` function**

This renders the collapsible section with file cards. No thumbnails yet — uses icons for all files.

```javascript
function renderFiles() {
  if (state.currentFiles.length === 0) {
    dom.filesSection.hidden = true;
    return;
  }

  dom.filesSection.hidden = false;
  dom.filesToggleText.textContent = 'קבצים (' + state.currentFiles.length + ')';
  dom.filesToggleIcon.className = 'files-section__chevron' +
    (state.filesExpanded ? ' files-section__chevron--open' : '');
  dom.fileList.hidden = !state.filesExpanded;
  dom.fileList.innerHTML = '';

  if (!state.filesExpanded) return;

  var query = state.searchQuery.trim().toLowerCase();

  state.currentFiles.forEach(function (file, index) {
    if (query && !file.name.toLowerCase().includes(query)) return;

    var li = document.createElement('li');
    var card = document.createElement('div');
    card.className = 'file-card';
    card.dataset.index = index;

    // Icon or thumbnail placeholder
    var inPhotosFolder = state.breadcrumbs.length > 0 &&
      state.breadcrumbs[state.breadcrumbs.length - 1].name === 'תמונות';
    if (inPhotosFolder && isImageFile(file.name)) {
      var thumb = document.createElement('img');
      thumb.className = 'file-card__thumb file-card__thumb--loading';
      thumb.alt = '';
      thumb.src = ''; // will be loaded lazily
      thumb.dataset.itemId = file.id;
      card.appendChild(thumb);
    } else {
      var icon = document.createElement('span');
      icon.className = 'file-card__icon';
      icon.textContent = getFileIcon(file.name);
      card.appendChild(icon);
    }

    // Filename
    var name = document.createElement('span');
    name.className = 'file-card__name';
    name.textContent = file.name;
    card.appendChild(name);

    // Action buttons
    var actions = document.createElement('span');
    actions.className = 'file-card__actions';

    var editBtn = document.createElement('button');
    editBtn.className = 'file-card__action-btn';
    editBtn.type = 'button';
    editBtn.textContent = '✏️';
    editBtn.title = 'שנה שם';
    (function (f, cardEl) {
      editBtn.addEventListener('click', function () { enterEditMode(f, cardEl); });
    })(file, card);

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'file-card__action-btn file-card__action-btn--danger';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'מחק';
    (function (f, cardEl, idx) {
      deleteBtn.addEventListener('click', function () { enterDeleteMode(f, cardEl, idx); });
    })(file, card, index);

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    card.appendChild(actions);

    li.appendChild(card);
    dom.fileList.appendChild(li);
  });
}
```

**Step 3: Wire up toggle button**

```javascript
dom.filesToggle.addEventListener('click', function () {
  state.filesExpanded = !state.filesExpanded;
  renderFiles();
});
```

**Step 4: Call `renderFiles()` from `fetchAndDisplay`**

After `renderFolders()` is called (and after the auto-selection checks), add `renderFiles()`.

Also reset files section in the loading phase:
```javascript
dom.filesSection.hidden = true;
```

**Step 5: Update search to re-render files too**

In the search input handler, add `renderFiles()` after `renderFolders()`.

**Step 6: Test — navigate to a folder with files, verify collapsible section appears**

**Step 7: Commit**
```
feat: render files in collapsible section below folders
```

---

### Task 7: Inline Rename

**Files:**
- Modify: `js/app.js`

**Step 1: Implement `enterEditMode`**

```javascript
function enterEditMode(file, cardEl) {
  var nameEl = cardEl.querySelector('.file-card__name');
  var actionsEl = cardEl.querySelector('.file-card__actions');

  // Replace name span with input
  var input = document.createElement('input');
  input.className = 'file-card__edit-input';
  input.type = 'text';
  input.value = file.name;
  nameEl.replaceWith(input);
  input.focus();
  // Select filename without extension
  var dotIndex = file.name.lastIndexOf('.');
  if (dotIndex > 0) {
    input.setSelectionRange(0, dotIndex);
  } else {
    input.select();
  }

  // Replace actions with save/cancel
  actionsEl.innerHTML = '';

  var saveBtn = document.createElement('button');
  saveBtn.className = 'file-card__confirm-btn file-card__confirm-btn--yes';
  saveBtn.type = 'button';
  saveBtn.textContent = '✓';
  saveBtn.title = 'שמור';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'file-card__confirm-btn file-card__confirm-btn--no';
  cancelBtn.type = 'button';
  cancelBtn.textContent = '✕';
  cancelBtn.title = 'ביטול';

  actionsEl.appendChild(saveBtn);
  actionsEl.appendChild(cancelBtn);

  cancelBtn.addEventListener('click', function () {
    renderFiles(); // re-render to reset
  });

  saveBtn.addEventListener('click', function () {
    var newName = input.value.trim();
    if (!newName || newName === file.name) {
      renderFiles();
      return;
    }

    // Show spinner
    actionsEl.innerHTML = '';
    var spinner = document.createElement('span');
    spinner.className = 'file-card__spinner';
    actionsEl.appendChild(spinner);
    input.disabled = true;

    renameFile(file.id, newName)
      .then(function () {
        file.name = newName;
        renderFiles();
      })
      .catch(function (err) {
        // Show error inline
        input.disabled = false;
        actionsEl.innerHTML = '';
        actionsEl.appendChild(saveBtn);
        actionsEl.appendChild(cancelBtn);
        var errorEl = document.createElement('div');
        errorEl.className = 'file-card__error';
        errorEl.textContent = err.message;
        cardEl.parentNode.appendChild(errorEl);
        setTimeout(function () { if (errorEl.parentNode) errorEl.parentNode.removeChild(errorEl); }, 3000);
      });
  });
}
```

**Step 2: Test rename — enter edit mode, change name, save, verify**

**Step 3: Commit**
```
feat: add inline file rename with save/cancel
```

---

### Task 8: Inline Delete

**Files:**
- Modify: `js/app.js`

**Step 1: Implement `enterDeleteMode`**

```javascript
function enterDeleteMode(file, cardEl, fileIndex) {
  var actionsEl = cardEl.querySelector('.file-card__actions');

  // Replace actions with confirmation
  actionsEl.innerHTML = '';
  var confirm = document.createElement('span');
  confirm.className = 'file-card__confirm';
  confirm.textContent = 'מחיקה?';

  var yesBtn = document.createElement('button');
  yesBtn.className = 'file-card__confirm-btn file-card__confirm-btn--yes';
  yesBtn.type = 'button';
  yesBtn.textContent = '✓';

  var noBtn = document.createElement('button');
  noBtn.className = 'file-card__confirm-btn file-card__confirm-btn--no';
  noBtn.type = 'button';
  noBtn.textContent = '✕';

  actionsEl.appendChild(confirm);
  actionsEl.appendChild(yesBtn);
  actionsEl.appendChild(noBtn);

  noBtn.addEventListener('click', function () {
    renderFiles(); // reset
  });

  yesBtn.addEventListener('click', function () {
    // Show spinner
    actionsEl.innerHTML = '';
    var spinner = document.createElement('span');
    spinner.className = 'file-card__spinner';
    actionsEl.appendChild(spinner);

    deleteFile(file.id)
      .then(function () {
        state.currentFiles.splice(fileIndex, 1);
        renderFiles();
      })
      .catch(function (err) {
        renderFiles(); // reset to normal state
        // Brief error flash on the card
        cardEl.style.borderColor = 'var(--error)';
        setTimeout(function () { cardEl.style.borderColor = ''; }, 2000);
      });
  });
}
```

**Step 2: Test delete — tap trash, confirm, verify file removed**

**Step 3: Commit**
```
feat: add inline file delete with confirmation
```

---

### Task 9: Thumbnails for Images in תמונות Folders

**Files:**
- Modify: `js/app.js`

**Step 1: Add thumbnail cache and loader**

```javascript
var thumbnailCache = {}; // { itemId: base64DataUrl }

function loadThumbnails() {
  var thumbEls = dom.fileList.querySelectorAll('.file-card__thumb[data-item-id]');
  thumbEls.forEach(function (el) {
    var itemId = el.dataset.itemId;
    if (!itemId) return;

    if (thumbnailCache[itemId]) {
      el.src = thumbnailCache[itemId];
      el.classList.remove('file-card__thumb--loading');
      return;
    }

    fetchThumbnail(itemId)
      .then(function (data) {
        // Adjust based on actual response format — could be data.url or data.base64
        var src = data.thumbnailUrl || data.url || ('data:image/jpeg;base64,' + data.base64);
        thumbnailCache[itemId] = src;
        el.src = src;
        el.classList.remove('file-card__thumb--loading');
      })
      .catch(function () {
        // Replace with icon on failure
        var icon = document.createElement('span');
        icon.className = 'file-card__icon';
        icon.textContent = '🖼️';
        el.replaceWith(icon);
      });
  });
}
```

**Step 2: Call `loadThumbnails()` after `renderFiles()` when expanded**

At the end of `renderFiles()`, after appending all items:
```javascript
if (state.filesExpanded) {
  loadThumbnails();
}
```

**Step 3: Test — navigate to a תמונות folder, verify thumbnails load**

Note: The exact response format from the thumbnail webhook needs to be verified after Task 1. The `fetchThumbnail` function and `loadThumbnails` may need adjustment based on whether Make.com returns base64, a direct URL, or redirects.

**Step 4: Commit**
```
feat: load thumbnails for images in photo folders
```

---

### Task 10: Post-Upload Cleanup

**Files:**
- Modify: `js/app.js` — `startUpload()` completion handler

**Step 1: Clear successful uploads after completion**

In the `uploadNext` function, when `index >= total` (all done), replace the current completion block:

```javascript
if (index >= total) {
  state.uploading = false;
  dom.uploadProgress.hidden = true;
  showUploadResult(done, failed, total);

  // Remove successfully uploaded photos, keep failed ones for retry
  state.photos = state.photos.filter(function (p) { return p.status === 'error'; });
  renderPhotos();
  updateUploadBtn();

  // Refresh file listing to show newly uploaded files
  var currentFolderId = state.uploadTargetId ||
    (state.breadcrumbs.length > 0 ? state.breadcrumbs[state.breadcrumbs.length - 1].id : null);
  if (currentFolderId) {
    fetchItems(currentFolderId)
      .then(function (items) {
        state.currentFiles = items.filter(function (item) { return !item.folder; });
        state.filesExpanded = true; // expand to show new files
        renderFiles();
      })
      .catch(function () {
        // Silent failure — not critical
      });
  }
  return;
}
```

**Step 2: Test — upload photos, verify they clear and appear in files list**

**Step 3: Commit**
```
feat: clear uploaded photos and refresh file listing after upload
```

---

### Task 11: Integration Testing and Polish

**Files:**
- All three files may need minor adjustments

**Step 1: Test full flow end-to-end**

1. Navigate to a project → visit → תמונות
2. Verify existing files appear with thumbnails
3. Upload new photos → verify they clear and appear in files list
4. Rename a file → verify name changes
5. Delete a file → verify it disappears
6. Navigate to a non-תמונות folder → verify files show with icons (no thumbnails)
7. Navigate to a folder with both subfolders and files → verify files section is collapsed
8. Navigate to a folder with only files → verify files section is expanded

**Step 2: Fix any issues found**

**Step 3: Commit**
```
fix: integration polish for file display and management
```

---

### Task 12: Deploy

**Step 1: Deploy to Cloudflare Pages**
```bash
npx wrangler pages deploy /Users/talorbach/Code/NisimBakara --project-name nisim-bakara
```

**Step 2: Push to GitHub**
```bash
git push origin main
```

**Step 3: Verify on production**

Open https://nisim-bakara.pages.dev and test the full flow.
