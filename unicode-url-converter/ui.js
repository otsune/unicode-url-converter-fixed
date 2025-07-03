import { getConversionMap, getHistory, setConversionMap, saveHistoryEntry, clearHistory } from './storage.js';

// chrome APIが利用可能かチェック
function isChromeAPI() {
  return typeof chrome !== 'undefined' && chrome.i18n;
}

// i18nメッセージを安全に取得
function getMessage(key, substitutions = []) {
  if (!isChromeAPI()) {
    // デフォルトメッセージ（英語）
    const defaultMessages = {
      'popup_title': 'Unicode URL Converter',
      'convert_btn': 'Convert Text',
      'settings_title': 'Customize Conversion Characters',
      'add_btn': 'Add',
      'export_btn': 'Export',
      'import_btn': 'Import',
      'editButton': 'Edit',
      'deleteButton': 'Delete',
      'historyTitle': 'Conversion History',
      'clearHistoryButton': 'Clear History',
      'statusSuccess': 'Conversion complete: $count$ characters converted.',
      'statusNoMatch': 'No target characters found.',
      'historyEmpty': 'No history yet.',
      'historyEntry': 'Converted $count$ characters',
      'alertDuplicateUnicode': 'This Unicode character has already been added.',
      'alertInvalidChar': 'Please enter a single character for the replacement.',
      'statusHistoryCleared': 'History cleared.',
      'example_info': 'Example:',
      'example_list': '˸ (U+02F8) → :<br>․ (U+2024) → .<br>⁄ (U+2044) → /'
    };
    let message = defaultMessages[key] || key;
    // Chrome i18n形式のプレースホルダーを処理
    if (substitutions.length > 0) {
      substitutions.forEach((sub, index) => {
        message = message.replace(`$${index + 1}`, sub);
        message = message.replace(`$count$`, sub);
      });
    }
    return message;
  }
  return chrome.i18n.getMessage(key, substitutions);
}

export function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const msg = getMessage(elem.dataset.i18n);
    if (msg) elem.innerText = msg;
  });
}

export function showStatus(success, message, count = 0) {
  const statusDiv = document.getElementById('status');
  statusDiv.style.display = 'block';
  statusDiv.className = 'status ' + (success ? 'success' : 'error');
  
  if (success && count > 0) {
    statusDiv.textContent = getMessage('statusSuccess', [count.toString()]);
  } else if (success && count === 0) {
    statusDiv.textContent = getMessage('statusNoMatch');
  } else {
    statusDiv.textContent = message;
  }
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

export async function renderConversionList() {
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
    const codePoint = unicode.replace('\\u', 'U+');
    li.innerHTML = `
      <span style="width:80px;text-align:center;">${String.fromCharCode(parseInt(unicode.replace('\\u',''),16))} (${codePoint})</span>
      <span style="width:30px;text-align:center;">→</span>
      <span style="width:30px;text-align:center;">${replace}</span>
      <button class="editBtn" data-key="${unicode}" style="margin-left:8px;">${getMessage('editButton')}</button>
      <button class="deleteBtn" data-key="${unicode}" style="margin-left:4px;">${getMessage('deleteButton')}</button>
    `;
    list.appendChild(li);
  });
}

export async function renderHistory() {
  const history = await getHistory();
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '';
  if (history.length === 0) {
    historyList.innerHTML = `<li>${getMessage('historyEmpty')}</li>`;
    return;
  }
  history.forEach(entry => {
    const li = document.createElement('li');
    li.style.fontSize = '12px';
    li.style.marginBottom = '4px';
    li.innerHTML = `
      <div title="${entry.url}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${new URL(entry.url).hostname}</div>
      <div style="color:#666;">${getMessage('historyEntry', [entry.count.toString()])} - ${new Date(entry.date).toLocaleString()}</div>
    `;
    historyList.appendChild(li);
  });
}

export function initSortableList(sortableList) {
  if (typeof Sortable === 'undefined') {
    console.warn('Sortable library not available');
    return;
  }
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
}

export async function handleAddFormSubmit(e) {
  e.preventDefault();
  const unicodeChar = document.getElementById('unicodeInput').value.trim();
  const replaceChar = document.getElementById('replaceInput').value.trim();
  if (!unicodeChar || !replaceChar) return;
  const unicodeKey = '\\u' + unicodeChar.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0');
  let map = await getConversionMap();
  if (map.hasOwnProperty(unicodeKey)) {
    alert(getMessage('alertDuplicateUnicode'));
    return;
  }
  map[unicodeKey] = replaceChar;
  setConversionMap(map);
  document.getElementById('addForm').reset();
  renderConversionList();
}

export async function handleConversionListClick(e) {
  if (e.target.classList.contains('deleteBtn')) {
    const key = e.target.dataset.key;
    let map = await getConversionMap();
    delete map[key];
    setConversionMap(map);
    renderConversionList();
  } else if (e.target.classList.contains('editBtn')) {
    const key = e.target.dataset.key;
    let map = await getConversionMap();
    const newChar = prompt(getMessage('editButton'), map[key]);
    if (newChar === null) return; // キャンセルされた場合は何もしない
    if (newChar.length !== 1) {
      alert(getMessage('alertInvalidChar'));
      return;
    }
    map[key] = newChar;
    setConversionMap(map);
    renderConversionList();
  }
}

export function handleClearHistoryClick() {
  clearHistory();
  renderHistory();
  showStatus(true, getMessage('statusHistoryCleared'));
}
