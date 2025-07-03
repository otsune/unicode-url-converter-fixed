document.addEventListener('DOMContentLoaded', function() {
  // i18n
  function localizeHtml() {
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const msg = chrome.i18n.getMessage(elem.dataset.i18n);
      if (msg) elem.innerText = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
      const msg = chrome.i18n.getMessage(elem.dataset.i18nPlaceholder);
      if (msg) elem.placeholder = msg;
    });
  }
  localizeHtml();

  const convertBtn = document.getElementById('convertBtn');
  const statusDiv = document.getElementById('status');

  convertBtn.addEventListener('click', async function() {
    try {
      // 現在のアクティブなタブを取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // ファイルURLの場合は特別な処理が必要
      if (tab.url.startsWith('file://')) {
        showStatus(false, chrome.i18n.getMessage('errorFileUrl'));
        return;
      }
      
      // コンテンツスクリプトが読み込まれているかチェック
      try {
        // まずpingメッセージを送信してコンテンツスクリプトの存在を確認
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (pingError) {
        // コンテンツスクリプトが読み込まれていない場合は手動で注入
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // 少し待ってからメッセージを送信
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (injectError) {
          showStatus(false, chrome.i18n.getMessage('errorInjectScript'));
          return;
        }
      }
      
      // コンテンツスクリプトに変換実行のメッセージを送信
      const tags = await getTargetTags();
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'convertText', tags: tags });
      
      // 結果を表示
      showStatus(response.success, response.message, response.count);
      if (response.success && response.count > 0) {
        const historyEntry = {
          url: tab.url,
          count: response.count,
          date: new Date().toISOString()
        };
        saveHistoryEntry(historyEntry);
      }
      
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Could not establish connection')) {
        showStatus(false, chrome.i18n.getMessage('errorConnection'));
      } else {
        showStatus(false, 'エラーが発生しました: ' + error.message);
      }
    }
  });

  function showStatus(success, message, count = 0) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status ' + (success ? 'success' : 'error');
    
    if (success && count > 0) {
      statusDiv.textContent = chrome.i18n.getMessage('statusSuccess', [count]);
    } else if (success && count === 0) {
      statusDiv.textContent = chrome.i18n.getMessage('statusNoMatch');
    } else {
      statusDiv.textContent = message;
    }
    
    // 3秒後にステータスを非表示にする
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  // デフォルト変換マップ
  const DEFAULT_MAP = {
    '\u02F8': ':',
    '\u2024': '.',
    '\u2044': '/'
  };

  // 変換マップをchrome.storageから取得
  async function getConversionMap() {
    return new Promise(resolve => {
      chrome.storage.local.get(['conversionMap'], result => {
        resolve(result.conversionMap || DEFAULT_MAP);
      });
    });
  }

  // 変換マップをchrome.storageに保存
  function setConversionMap(map) {
    chrome.storage.local.set({ conversionMap: map });
  }

  // リストを描画
  async function renderConversionList() {
    const map = await getConversionMap();
    const list = document.getElementById('conversionList');
    list.innerHTML = '';
    Object.entries(map).forEach(([unicode, replace]) => {
      const li = document.createElement('li');
      li.dataset.key = unicode;
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.marginBottom = '4px';
      li.style.cursor = 'grab';
      const codePoint = unicode.replace('\u', 'U+');
      li.innerHTML = `
        <span style="width:80px;text-align:center;">${String.fromCharCode(parseInt(unicode.replace('\u',''),16))} (${codePoint})</span>
        <span style="width:30px;text-align:center;">→</span>
        <span style="width:30px;text-align:center;">${replace}</span>
        <button class="editBtn" data-key="${unicode}" style="margin-left:8px;">${chrome.i18n.getMessage('editButton')}</button>
        <button class="deleteBtn" data-key="${unicode}" style="margin-left:4px;">${chrome.i18n.getMessage('deleteButton')}</button>
      `;
      list.appendChild(li);
    });
  }

  // SortableJSを初期化
  const sortableList = document.getElementById('conversionList');
  new Sortable(sortableList, {
    animation: 150,
    onEnd: async function (evt) {
      const newOrder = Array.from(evt.target.children).map(item => item.dataset.key);
      let map = await getConversionMap();
      const newMap = {};
      newOrder.forEach(key => {
        newMap[key] = map[key];
      });
      setConversionMap(newMap);
    }
  });

  // 追加フォーム処理
  const addForm = document.getElementById('addForm');
  addForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const unicodeChar = document.getElementById('unicodeInput').value.trim();
    const replaceChar = document.getElementById('replaceInput').value.trim();
    if (!unicodeChar || !replaceChar) return;
    const unicodeKey = '\u' + unicodeChar.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0');
    let map = await getConversionMap();
    if (map.hasOwnProperty(unicodeKey)) {
      alert(chrome.i18n.getMessage('alertDuplicateUnicode'));
      return;
    }
    map[unicodeKey] = replaceChar;
    setConversionMap(map);
    addForm.reset();
    renderConversionList();
  });

  // 編集・削除ボタン処理
  const list = document.getElementById('conversionList');
  list.addEventListener('click', async function(e) {
    if (e.target.classList.contains('deleteBtn')) {
      const key = e.target.dataset.key;
      let map = await getConversionMap();
      delete map[key];
      setConversionMap(map);
      renderConversionList();
    } else if (e.target.classList.contains('editBtn')) {
      const key = e.target.dataset.key;
      let map = await getConversionMap();
      const newChar = prompt(chrome.i18n.getMessage('editButton'), map[key]);
      if (newChar === null) return; // キャンセルされた場合は何もしない
      if (newChar.length !== 1) {
        alert(chrome.i18n.getMessage('alertInvalidChar'));
        return;
      }
      map[key] = newChar;
      setConversionMap(map);
      renderConversionList();
    }
  });

  renderConversionList();

  // 変換対象タグの処理
  const tagsForm = document.getElementById('tagsForm');
  const tagsInput = document.getElementById('tagsInput');

  async function getTargetTags() {
    return new Promise(resolve => {
      chrome.storage.local.get(['targetTags'], result => {
        resolve(result.targetTags || 'p');
      });
    });
  }

  function setTargetTags(tags) {
    chrome.storage.local.set({ targetTags: tags });
  }

  tagsForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const tags = tagsInput.value.trim();
    if (tags) {
      setTargetTags(tags);
      showStatus(true, chrome.i18n.getMessage('statusTagsSaved'));
    }
  });

  async function initTagsInput() {
    const tags = await getTargetTags();
    tagsInput.value = tags;
  }

  initTagsInput();

  // インポート・エクスポート処理
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const exportBtn = document.getElementById('exportBtn');
  const resetBtn = document.getElementById('resetBtn');

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const map = JSON.parse(e.target.result);
        // TODO: インポートされたデータのバリデーション
        setConversionMap(map);
        renderConversionList();
        showStatus(true, chrome.i18n.getMessage('statusImportSuccess'));
      } catch (error) {
        showStatus(false, chrome.i18n.getMessage('statusImportError'));
      }
    };
    reader.readAsText(file);
  });

  exportBtn.addEventListener('click', async () => {
    const map = await getConversionMap();
    const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unicode-converter-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmReset'))) {
      chrome.storage.local.remove(['conversionMap', 'targetTags'], () => {
        renderConversionList();
        initTagsInput();
        showStatus(true, chrome.i18n.getMessage('statusResetSuccess'));
      });
    }
  });

  // 履歴処理
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  async function getHistory() {
    return new Promise(resolve => {
      chrome.storage.local.get(['conversionHistory'], result => {
        resolve(result.conversionHistory || []);
      });
    });
  }

  async function saveHistoryEntry(entry) {
    let history = await getHistory();
    history.unshift(entry); // 新しいものを先頭に追加
    if (history.length > 50) { // 履歴は最新50件まで
      history = history.slice(0, 50);
    }
    chrome.storage.local.set({ conversionHistory: history }, () => {
      renderHistory(); // 保存後に履歴を再描画
    });
  }

  async function renderHistory() {
    const history = await getHistory();
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = `<li>${chrome.i18n.getMessage('historyEmpty')}</li>`;
      return;
    }
    history.forEach(entry => {
      const li = document.createElement('li');
      li.style.fontSize = '12px';
      li.style.marginBottom = '4px';
      li.innerHTML = `
        <div title="${entry.url}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${new URL(entry.url).hostname}</div>
        <div style="color:#666;">${chrome.i18n.getMessage('historyEntry', [entry.count])} - ${new Date(entry.date).toLocaleString()}</div>
      `;
      historyList.appendChild(li);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ conversionHistory: [] }, () => {
      renderHistory();
      showStatus(true, chrome.i18n.getMessage('statusHistoryCleared'));
    });
  });

  renderHistory();
});

