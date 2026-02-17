(function () {
  'use strict';

  // ============================================
  // Constants
  // ============================================
  var WEBHOOK_URL = 'https://hook.eu1.make.com/9jkw4vo5taer3ewajbu6t1c5tvrkgs2k';
  var ROOT_NAME = 'תיקים לבקרה';
  var CREATE_FOLDER_WEBHOOK = 'https://hook.eu1.make.com/ryl1lrkm2tb9re6kgbdh1frud3ityhqy';
  var UPLOAD_WEBHOOK = 'https://hook.eu1.make.com/a9rz1tlo9t4q6ki8nlrx1qpr4teafimb';

  // ============================================
  // State
  // ============================================
  var state = {
    breadcrumbs: [],        // [{name, id}]
    currentItems: [],       // folders at current level
    pendingAutoChecks: [],  // ['bikort', 'dochot']
    autoMessages: [],       // accumulated auto-selection messages
    targetFolder: null,     // תמונות folder if found
    searchQuery: '',
    photos: [],           // [{file, name, ext, status, thumbUrl}] — status: pending|uploading|done|error
    uploading: false,
    uploadTargetId: null, // driveItemId of the folder to upload into
  };

  // ============================================
  // DOM References
  // ============================================
  var dom = {
    navBar: document.getElementById('nav-bar'),
    backBtn: document.getElementById('back-btn'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    autoMsg: document.getElementById('auto-msg'),
    searchBox: document.getElementById('search-box'),
    searchInput: document.getElementById('search-input'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorText: document.getElementById('error-text'),
    retryBtn: document.getElementById('retry-btn'),
    empty: document.getElementById('empty'),
    folderList: document.getElementById('folder-list'),
    targetFolder: document.getElementById('target-folder'),
    targetPath: document.getElementById('target-path'),
    targetNote: document.getElementById('target-note'),
    createVisit: document.getElementById('create-visit'),
    createVisitBtn: document.getElementById('create-visit-btn'),
    visitForm: document.getElementById('visit-form'),
    visitName: document.getElementById('visit-name'),
    uploadSection: document.getElementById('upload-section'),
    photoInput: document.getElementById('photo-input'),
    photoList: document.getElementById('photo-list'),
    uploadBtn: document.getElementById('upload-btn'),
    uploadProgress: document.getElementById('upload-progress'),
    progressFill: document.getElementById('progress-fill'),
    progressText: document.getElementById('progress-text'),
    uploadResult: document.getElementById('upload-result'),
    resultText: document.getElementById('result-text'),
    resultCloseBtn: document.getElementById('result-close-btn'),
    confirmVisitBtn: document.getElementById('confirm-visit-btn'),
    visitCreating: document.getElementById('visit-creating'),
    visitError: document.getElementById('visit-error'),
  };

  // ============================================
  // API
  // ============================================
  function fetchFolders(folderId) {
    return fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: folderId }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('שגיאת שרת: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        // Handle both raw array and { value: [...] } responses
        var items = Array.isArray(data) ? data : (data.value || []);
        // Keep only folders
        return items.filter(function (item) { return item.folder; });
      });
  }

  function createFolder(parentId, folderName) {
    return fetch(CREATE_FOLDER_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: parentId, folderName: folderName }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('שגיאה ביצירת תיקיה: ' + response.status);
        }
        return response.json();
      });
  }

  // ============================================
  // Navigation
  // ============================================
  function loadRoot() {
    state.breadcrumbs = [{ name: ROOT_NAME, id: 'root' }];
    state.pendingAutoChecks = [];
    state.autoMessages = [];
    state.targetFolder = null;
    state.searchQuery = '';
    dom.searchInput.value = '';
    fetchAndDisplay('root');
  }

  function selectFolder(folderId, folderName) {
    var isProjectSelection = state.breadcrumbs.length === 1;
    state.breadcrumbs.push({ name: folderName, id: folderId });

    if (isProjectSelection) {
      state.pendingAutoChecks = ['bikort', 'dochot'];
      state.autoMessages = [];
    }

    state.targetFolder = null;
    state.searchQuery = '';
    dom.searchInput.value = '';
    fetchAndDisplay(folderId);
  }

  function navigateToBreadcrumb(index) {
    if (index >= state.breadcrumbs.length - 1) return;
    var crumb = state.breadcrumbs[index];
    state.breadcrumbs = state.breadcrumbs.slice(0, index + 1);
    state.pendingAutoChecks = [];
    state.autoMessages = [];
    state.targetFolder = null;
    state.searchQuery = '';
    dom.searchInput.value = '';
    fetchAndDisplay(crumb.id);
  }

  function fetchAndDisplay(folderId) {
    showLoading(true);
    hideError();
    hideEmpty();
    dom.folderList.innerHTML = '';
    dom.targetFolder.hidden = true;
    dom.uploadSection.hidden = true;
    state.photos.forEach(function (p) { URL.revokeObjectURL(p.thumbUrl); });
    state.photos = [];
    state.uploading = false;
    state.uploadTargetId = null;
    dom.createVisit.hidden = true;
    dom.visitForm.hidden = true;
    dom.autoMsg.hidden = true;

    fetchFolders(folderId)
      .then(function (folders) {
        state.currentItems = folders;
        showLoading(false);

        if (folders.length === 0) {
          // Check if we're inside a visit folder (תמונות will be created on first upload)
          var currentName = state.breadcrumbs.length > 0
            ? state.breadcrumbs[state.breadcrumbs.length - 1].name
            : '';
          if (/(?:דוח\s+)?ביקור/.test(currentName)) {
            state.targetFolder = { name: 'תמונות', id: state.breadcrumbs[state.breadcrumbs.length - 1].id, create: true };
            state.targetFolderExists = false;
            showTargetFolder();
          }
          showEmpty();
          renderBreadcrumbs();
          updateSearchVisibility();
          updateCreateVisitVisibility();
          return;
        }

        // Check for תמונות
        var photosFolder = folders.find(function (f) { return f.name === 'תמונות'; });
        if (photosFolder) {
          state.targetFolder = photosFolder;
          state.targetFolderExists = true;
        } else {
          // Check if we're inside a visit folder (תמונות will be created on first upload)
          var currentName = state.breadcrumbs.length > 0
            ? state.breadcrumbs[state.breadcrumbs.length - 1].name
            : '';
          var isVisitFolder = /(?:דוח\s+)?ביקור/.test(currentName);
          if (isVisitFolder) {
            state.targetFolder = { name: 'תמונות', id: state.breadcrumbs[state.breadcrumbs.length - 1].id, create: true };
            state.targetFolderExists = false;
          }
        }

        // Auto-selection cascade
        if (state.pendingAutoChecks.length > 0) {
          var check = state.pendingAutoChecks[0];

          if (check === 'bikort') {
            state.pendingAutoChecks.shift();
            var match = folders.find(function (f) { return f.name === 'בקרת ביצוע'; });
            if (match) {
              state.autoMessages.push('בקרת ביצוע');
              state.breadcrumbs.push({ name: match.name, id: match.id });
              fetchAndDisplay(match.id);
              return;
            }
          } else if (check === 'dochot') {
            state.pendingAutoChecks.shift();
            var matches = folders.filter(function (f) { return f.name.startsWith('דוחות'); });
            if (matches.length === 1) {
              state.autoMessages.push(matches[0].name);
              state.breadcrumbs.push({ name: matches[0].name, id: matches[0].id });
              fetchAndDisplay(matches[0].id);
              return;
            }
          }
        }

        // Show auto-selection notification
        if (state.autoMessages.length > 0) {
          showAutoSelectMsg(state.autoMessages);
          state.autoMessages = [];
        }

        renderBreadcrumbs();
        renderFolders();
        updateSearchVisibility();
        showTargetFolder();
        updateCreateVisitVisibility();
      })
      .catch(function (err) {
        showLoading(false);
        showError(err.message || 'שגיאה בטעינת תיקיות');
        renderBreadcrumbs();
      });
  }

  // ============================================
  // Rendering
  // ============================================
  function renderBreadcrumbs() {
    dom.navBar.hidden = state.breadcrumbs.length <= 1;
    dom.breadcrumbs.innerHTML = '';

    state.breadcrumbs.forEach(function (crumb, index) {
      if (index > 0) {
        var sep = document.createElement('span');
        sep.className = 'breadcrumbs__sep';
        sep.textContent = '/';
        dom.breadcrumbs.appendChild(sep);
      }

      var item = document.createElement('button');
      item.className = 'breadcrumbs__item';
      item.textContent = crumb.name;
      item.type = 'button';

      if (index === state.breadcrumbs.length - 1) {
        item.classList.add('breadcrumbs__item--active');
        item.disabled = true;
      } else {
        (function (i) {
          item.addEventListener('click', function () { navigateToBreadcrumb(i); });
        })(index);
      }

      dom.breadcrumbs.appendChild(item);
    });
  }

  function renderFolders() {
    dom.folderList.innerHTML = '';
    var query = state.searchQuery.trim().toLowerCase();
    var filtered = query
      ? state.currentItems.filter(function (f) { return f.name.toLowerCase().includes(query); })
      : state.currentItems;

    if (filtered.length === 0 && query) {
      var noResults = document.createElement('li');
      noResults.className = 'folder-list__empty';
      noResults.textContent = 'לא נמצאו תוצאות';
      dom.folderList.appendChild(noResults);
      return;
    }

    filtered.forEach(function (folder) {
      var li = document.createElement('li');

      var btn = document.createElement('button');
      btn.className = 'folder-card';
      btn.type = 'button';

      var icon = document.createElement('span');
      icon.className = 'folder-card__icon';
      icon.textContent = '📁';

      var name = document.createElement('span');
      name.className = 'folder-card__name';
      name.textContent = folder.name;

      var count = document.createElement('span');
      count.className = 'folder-card__count';
      if (folder.folder && folder.folder.childCount > 0) {
        count.textContent = folder.folder.childCount + ' פריטים';
      }

      var arrow = document.createElement('span');
      arrow.className = 'folder-card__arrow';
      arrow.textContent = '\u2039'; // ‹

      btn.appendChild(icon);
      btn.appendChild(name);
      btn.appendChild(count);
      btn.appendChild(arrow);

      (function (f) {
        btn.addEventListener('click', function () { selectFolder(f.id, f.name); });
      })(folder);

      li.appendChild(btn);
      dom.folderList.appendChild(li);
    });
  }

  // ============================================
  // UI Helpers
  // ============================================
  function showLoading(show) {
    dom.loading.hidden = !show;
    if (show) {
      dom.folderList.innerHTML = '';
      dom.empty.hidden = true;
    }
  }

  function showError(message) {
    dom.error.hidden = false;
    dom.errorText.textContent = message;
  }

  function hideError() {
    dom.error.hidden = true;
  }

  function showEmpty() {
    dom.empty.hidden = false;
  }

  function hideEmpty() {
    dom.empty.hidden = true;
  }

  function showAutoSelectMsg(messages) {
    dom.autoMsg.hidden = false;
    dom.autoMsg.textContent = 'נבחר אוטומטית: ' + messages.join(', ');
  }

  function showTargetFolder() {
    if (!state.targetFolder) {
      dom.targetFolder.hidden = true;
      return;
    }
    dom.targetFolder.hidden = false;
    var path = state.breadcrumbs.map(function (b) { return b.name; }).join(' / ') + ' / תמונות';
    dom.targetPath.textContent = path;
    dom.targetNote.textContent = state.targetFolderExists
      ? 'תמונות יועלו לתיקיה זו'
      : 'תיקיית תמונות תיווצר אוטומטית בהעלאה הראשונה';

    // Show upload section when we have a target
    if (state.targetFolder) {
      dom.uploadSection.hidden = false;
      state.uploadTargetId = state.targetFolderExists
        ? state.targetFolder.id
        : null; // will be set after folder creation
    } else {
      dom.uploadSection.hidden = true;
    }
  }

  function updateSearchVisibility() {
    var show = state.breadcrumbs.length === 1 || state.currentItems.length > 15;
    dom.searchBox.hidden = !show;
    if (show) {
      dom.searchInput.placeholder = state.breadcrumbs.length === 1
        ? 'חיפוש פרויקט...'
        : 'חיפוש תיקיה...';
    }
    if (!show) {
      state.searchQuery = '';
      dom.searchInput.value = '';
    }
  }

  function updateCreateVisitVisibility() {
    // Show after auto-selection is done and we're deep enough
    var show = state.pendingAutoChecks.length === 0 && state.breadcrumbs.length >= 4;
    dom.createVisit.hidden = !show;
    if (show) {
      dom.visitForm.hidden = true;
    }
  }

  // ============================================
  // Create Visit Name
  // ============================================
  function generateVisitName() {
    var visitFolders = state.currentItems.filter(function (f) {
      return f.name.includes('ביקור');
    });

    var maxNum = 0;
    visitFolders.forEach(function (f) {
      var match = f.name.match(/(?:דוח\s+)?ביקור\s*[-\s]*(?:מס(?:פר|'?)?\s*[-\s]*)?(\d+)/);
      if (match) {
        var parsed = parseInt(match[1], 10);
        if (parsed > maxNum) maxNum = parsed;
      }
    });

    var nextNum = maxNum + 1;
    var today = new Date();
    var day = String(today.getDate()).padStart(2, '0');
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var year = today.getFullYear();
    return 'ביקור ' + nextNum + ' ' + day + '-' + month + '-' + year;
  }

  // ============================================
  // Photo Management
  // ============================================
  function addPhotos(files) {
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      var ext = file.name.substring(file.name.lastIndexOf('.'));
      state.photos.push({
        file: file,
        name: 'תמונה ' + (state.photos.length + 1),
        ext: ext,
        status: 'pending',
        thumbUrl: URL.createObjectURL(file),
      });
    }
    renderPhotos();
    updateUploadBtn();
  }

  function removePhoto(index) {
    URL.revokeObjectURL(state.photos[index].thumbUrl);
    state.photos.splice(index, 1);
    // Renumber default names
    state.photos.forEach(function (p, i) {
      if (/^תמונה \d+$/.test(p.name)) {
        p.name = 'תמונה ' + (i + 1);
      }
    });
    renderPhotos();
    updateUploadBtn();
  }

  function renderPhotos() {
    dom.photoList.innerHTML = '';
    state.photos.forEach(function (photo, index) {
      var li = document.createElement('li');
      li.className = 'photo-item';
      if (photo.status === 'error') li.className += ' photo-item--error';
      if (photo.status === 'done') li.className += ' photo-item--success';

      var thumb = document.createElement('img');
      thumb.className = 'photo-item__thumb';
      thumb.src = photo.thumbUrl;
      thumb.alt = '';

      var nameInput = document.createElement('input');
      nameInput.className = 'photo-item__name';
      nameInput.type = 'text';
      nameInput.value = photo.name;
      nameInput.dir = 'rtl';
      nameInput.disabled = state.uploading;
      (function (idx) {
        nameInput.addEventListener('input', function () {
          state.photos[idx].name = nameInput.value;
          updateUploadBtn();
        });
      })(index);

      li.appendChild(thumb);
      li.appendChild(nameInput);

      if (state.uploading) {
        var status = document.createElement('span');
        status.className = 'photo-item__status';
        if (photo.status === 'done') status.textContent = '\u2705';
        else if (photo.status === 'error') status.textContent = '\u274C';
        else if (photo.status === 'uploading') status.textContent = '\u23F3';
        li.appendChild(status);
      } else {
        var removeBtn = document.createElement('button');
        removeBtn.className = 'photo-item__remove';
        removeBtn.type = 'button';
        removeBtn.textContent = '\u00D7';
        removeBtn.title = 'הסר';
        (function (idx) {
          removeBtn.addEventListener('click', function () { removePhoto(idx); });
        })(index);
        li.appendChild(removeBtn);
      }

      dom.photoList.appendChild(li);
    });
  }

  function updateUploadBtn() {
    var hasPhotos = state.photos.length > 0;
    var allNamed = state.photos.every(function (p) { return p.name.trim() !== ''; });
    dom.uploadBtn.disabled = !hasPhotos || !allNamed || state.uploading;
    dom.uploadBtn.textContent = hasPhotos
      ? 'העלאה (' + state.photos.length + ' תמונות)'
      : 'העלאה';
  }

  // ============================================
  // Event Handlers
  // ============================================
  dom.searchInput.addEventListener('input', function () {
    state.searchQuery = dom.searchInput.value;
    renderFolders();
  });

  dom.backBtn.addEventListener('click', function () {
    if (state.breadcrumbs.length > 1) {
      navigateToBreadcrumb(state.breadcrumbs.length - 2);
    }
  });

  dom.retryBtn.addEventListener('click', function () {
    var current = state.breadcrumbs[state.breadcrumbs.length - 1];
    if (current) {
      fetchAndDisplay(current.id);
    } else {
      loadRoot();
    }
  });

  dom.createVisitBtn.addEventListener('click', function () {
    var name = generateVisitName();
    dom.visitName.value = name;
    dom.visitForm.hidden = false;
    dom.visitError.hidden = true;
  });

  dom.confirmVisitBtn.addEventListener('click', function () {
    var visitName = dom.visitName.value.trim();
    if (!visitName) return;

    var parentId = state.breadcrumbs[state.breadcrumbs.length - 1].id;

    dom.confirmVisitBtn.hidden = true;
    dom.visitCreating.hidden = false;
    dom.visitError.hidden = true;
    dom.visitName.disabled = true;

    // Step 1: Create visit folder
    createFolder(parentId, visitName)
      .then(function (visitFolder) {
        // Step 2: Create תמונות inside it
        return createFolder(visitFolder.id, 'תמונות')
          .then(function (photosFolder) {
            return { visitFolder: visitFolder, photosFolder: photosFolder };
          });
      })
      .then(function (result) {
        // Success: update breadcrumbs and set target
        state.breadcrumbs.push({ name: result.visitFolder.name, id: result.visitFolder.id });
        state.breadcrumbs.push({ name: 'תמונות', id: result.photosFolder.id });
        state.targetFolder = result.photosFolder;
        state.targetFolderExists = true;
        state.uploadTargetId = result.photosFolder.id;

        // Update UI
        renderBreadcrumbs();
        dom.createVisit.hidden = true;
        dom.folderList.innerHTML = '';
        dom.empty.hidden = true;
        showTargetFolder();
      })
      .catch(function (err) {
        dom.visitError.textContent = err.message || 'שגיאה ביצירת תיקיה';
        dom.visitError.hidden = false;
      })
      .then(function () {
        // Always reset form state
        dom.confirmVisitBtn.hidden = false;
        dom.visitCreating.hidden = true;
        dom.visitName.disabled = false;
      });
  });

  dom.photoInput.addEventListener('change', function () {
    if (dom.photoInput.files.length > 0) {
      addPhotos(dom.photoInput.files);
    }
    dom.photoInput.value = ''; // allow re-selecting same files
  });

  dom.resultCloseBtn.addEventListener('click', function () {
    dom.uploadResult.hidden = true;
  });

  // ============================================
  // Init
  // ============================================
  loadRoot();
})();
