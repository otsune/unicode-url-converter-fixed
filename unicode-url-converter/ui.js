import { getConversionMap, getHistory, setConversionMap, saveHistoryEntry, clearHistory } from './storage.js';
import { isChromeI18n } from './common.js';

/**
 * 指定されたキーに対応する国際化メッセージを取得します。
 * Chrome APIが利用できない場合は、デフォルトのメッセージを使用します。
 * @param {string} key - メッセージのキー。
 * @param {Array<string|number>} [substitutions=[]] - メッセージ内のプレースホルダーを置き換えるための値の配列。
 * @returns {string} 取得されたメッセージ文字列。
 */
function getMessage(key, substitutions = []) {
  if (!isChromeI18n()) {
    // デフォルトメッセージ（英語）
    const defaultMessages = {
      'popupTitle': 'Unicode URL Converter',
      'convertButton': 'Convert Text',
      'customizeTitle': 'Customize Conversion Characters',
      'addButton': 'Add',
      'exportButton': 'Export',
      'importButton': 'Import',
      'editButton': 'Edit',
      'deleteButton': 'Delete',
      'historyTitle': 'Conversion History',
      'clearHistoryButton': 'Clear History',
      'addUnicodePlaceholder': 'e.g., ˸',
      'addReplacePlaceholder': ':',
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

/**
 * HTML要素のdata-i18n属性とdata-i18n-placeholder属性に基づいて、
 * ページ内のテキストを国際化メッセージに置き換えます。
 */
export function localizeHtml() {
  // data-i18n属性を持つ要素を処理
  document.querySelectorAll('[data-i18n]').forEach(elem => {
    const msg = getMessage(elem.dataset.i18n);
    if (msg) elem.innerHTML = msg;
  });
  
  // data-i18n-placeholder属性を持つ要素を処理
  document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
    const msg = getMessage(elem.dataset.i18nPlaceholder);
    if (msg) elem.placeholder = msg;
  });
}

/**
 * ユーザーインターフェースにステータスメッセージを表示します。
 * メッセージは一定時間後に自動的に非表示になります。
 * @param {boolean} success - 処理が成功したかどうかを示すフラグ。成功ならtrue、失敗ならfalse。
 * @param {string} message - 表示するメッセージテキスト。
 * @param {number} [count=0] - 変換された文字数など、表示する数値。
 */
// ステータス表示のタイマー管理
let statusTimer = null;

export function showStatus(success, message, count = 0) {
  const statusDiv = document.getElementById('status');
  
  // 既存のタイマーをクリア（メモリリーク対策）
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  
  statusDiv.style.display = 'block';
  statusDiv.className = 'status ' + (success ? 'success' : 'error');
  
  if (success && count > 0) {
    statusDiv.textContent = getMessage('statusSuccess', [count.toString()]);
  } else if (success && count === 0) {
    statusDiv.textContent = getMessage('statusNoMatch');
  } else {
    statusDiv.textContent = message;
  }
  
  // タイマーを管理してメモリリークを防止
  statusTimer = setTimeout(() => {
    statusDiv.style.display = 'none';
    statusTimer = null;
  }, 3000);
}

/**
 * 変換リストをレンダリングし、UIに表示します。
 * ストレージから現在の変換マップを取得し、それに基づいてリストアイテムを生成します。
 */
export async function renderConversionList() {
  const map = await getConversionMap();
  const list = document.getElementById('conversionList');
  
  // DocumentFragmentを使用してバッチ更新
  const fragment = document.createDocumentFragment();
  
  Object.entries(map).forEach(([unicode, replace]) => {
    const li = document.createElement('li');
    li.dataset.key = unicode;
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.marginBottom = '4px';
    li.style.cursor = 'grab';
    
    const codePoint = unicode.replace('\\u', 'U+');
    
    // XSS対策：安全なDOM要素作成
    const unicodeSpan = document.createElement('span');
    unicodeSpan.style.width = '80px';
    unicodeSpan.style.textAlign = 'center';
    unicodeSpan.textContent = `${String.fromCharCode(parseInt(unicode.replace('\\u',''),16))} (${codePoint})`;
    
    const arrowSpan = document.createElement('span');
    arrowSpan.style.width = '30px';
    arrowSpan.style.textAlign = 'center';
    arrowSpan.textContent = '→';
    
    const replaceSpan = document.createElement('span');
    replaceSpan.style.width = '30px';
    replaceSpan.style.textAlign = 'center';
    replaceSpan.textContent = replace; // ユーザー入力の安全な表示
    
    const editBtn = document.createElement('button');
    editBtn.className = 'editBtn';
    editBtn.dataset.key = unicode;
    editBtn.style.marginLeft = '8px';
    editBtn.textContent = getMessage('editButton');
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'deleteBtn';
    deleteBtn.dataset.key = unicode;
    deleteBtn.style.marginLeft = '4px';
    deleteBtn.textContent = getMessage('deleteButton');
    
    // 要素を組み立て
    li.appendChild(unicodeSpan);
    li.appendChild(arrowSpan);
    li.appendChild(replaceSpan);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    
    fragment.appendChild(li);
  });
  
  // 一括でDOM更新（パフォーマンス向上）
  list.replaceChildren(fragment);
}

/**
 * 変換履歴をレンダリングし、UIに表示します。
 * ストレージから履歴データを取得し、リストアイテムとして表示します。
 */
export async function renderHistory() {
  const history = await getHistory();
  const historyList = document.getElementById('historyList');
  
  // 履歴が空の場合
  if (history.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.textContent = getMessage('historyEmpty');
    historyList.replaceChildren(emptyLi);
    return;
  }
  
  // DocumentFragmentを使用してバッチ更新
  const fragment = document.createDocumentFragment();
  
  history.forEach(entry => {
    const li = document.createElement('li');
    li.style.fontSize = '12px';
    li.style.marginBottom = '4px';
    
    // XSS対策：安全なDOM要素作成
    const urlDiv = document.createElement('div');
    urlDiv.title = entry.url; // title属性は安全
    urlDiv.style.whiteSpace = 'nowrap';
    urlDiv.style.overflow = 'hidden';
    urlDiv.style.textOverflow = 'ellipsis';
    urlDiv.textContent = new URL(entry.url).hostname; // 安全なテキスト表示
    
    const detailDiv = document.createElement('div');
    detailDiv.style.color = '#666';
    detailDiv.textContent = `${getMessage('historyEntry', [entry.count.toString()])} - ${new Date(entry.date).toLocaleString()}`;
    
    li.appendChild(urlDiv);
    li.appendChild(detailDiv);
    fragment.appendChild(li);
  });
  
  // 一括でDOM更新
  historyList.replaceChildren(fragment);
}

export function initSortableList(sortableList) {
  if (typeof Sortable === 'undefined') {
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
