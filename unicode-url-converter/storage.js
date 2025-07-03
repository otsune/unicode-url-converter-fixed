// デフォルトの変換マップ
// Unicode文字を対応するASCII文字に変換するためのデフォルト設定
const DEFAULT_MAP = {
  '\u02F8': ':',
  '\u2024': '.',
  '\u2044': '/'
};

/**
 * Chrome拡張APIが利用可能かどうかをチェックします。
 * 特にchrome.storage.localが利用可能であることを確認します。
 * @returns {boolean} Chrome APIが利用可能な場合はtrue、そうでない場合はfalse。
 */
function isChromeAPI() {
  return typeof chrome !== 'undefined' &&
         typeof chrome.storage !== 'undefined' &&
         typeof chrome.storage.local !== 'undefined';
}

export async function getConversionMap() {
  if (!isChromeAPI()) {
    return DEFAULT_MAP;
  }
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionMap'], result => {
      resolve(result.conversionMap || DEFAULT_MAP);
    });
  });
}

/**
 * 変換マップをChromeストレージに保存します。
 * @param {Object} map - 保存する変換マップオブジェクト。
 */
export function setConversionMap(map) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  chrome.storage.local.set({ conversionMap: map });
}

/**
 * 変換対象のHTMLタグ（セレクタ）を非同期で取得します。
 * Chromeストレージに保存された設定があればそれを、なければデフォルト値（'p'）を使用します。
 * @returns {Promise<string>} 変換対象のタグセレクタを解決するPromise。
 */
export async function getTargetTags() {
  if (!isChromeAPI()) {
    return 'p';
  }
  return new Promise(resolve => {
    chrome.storage.local.get(['targetTags'], result => {
      resolve(result.targetTags || 'p');
    });
  });
}

/**
 * 変換対象のHTMLタグ（セレクタ）をChromeストレージに保存します。
 * @param {string} tags - 保存するタグセレクタ文字列。
 */
export function setTargetTags(tags) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  chrome.storage.local.set({ targetTags: tags });
}

export async function getHistory() {
  if (!isChromeAPI()) {
    console.log('Chrome API not available, returning empty history');
    return [];
  }
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionHistory'], result => {
      console.log('Retrieved history from storage:', result.conversionHistory);
      resolve(result.conversionHistory || []);
    });
  });
}

export async function saveHistoryEntry(entry) {
  console.log('saveHistoryEntry called with:', entry);
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  let history = await getHistory();
  console.log('Current history:', history);
  history.unshift(entry); // 新しいものを先頭に追加
  if (history.length > 50) { // 履歴は最新50件まで
    history = history.slice(0, 50);
  }
  console.log('Updated history:', history);
  chrome.storage.local.set({ conversionHistory: history }, () => {
    console.log('History saved to storage');
  });
}

/**
 * 変換履歴をすべてクリアします。
 */
export function clearHistory() {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  chrome.storage.local.set({ conversionHistory: [] });
}

/**
 * 指定されたキーのストレージ設定を削除します。
 * @param {string|string[]} keys - 削除するキー、またはキーの配列。
 * @param {function} [callback] - 削除完了後に呼び出されるコールバック関数。
 */
export function removeSettings(keys, callback) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    if (callback) callback();
    return;
  }
  chrome.storage.local.remove(keys, callback);
}
