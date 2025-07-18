import { isChromeAPI, getDefaultConversionMap } from './common.js';

export async function getConversionMap() {
  if (!isChromeAPI()) {
    return getDefaultConversionMap();
  }
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionMap'], result => {
      resolve(result.conversionMap || getDefaultConversionMap());
    });
  });
}

/**
 * 変換マップをChromeストレージに保存します。
 * @param {Object} map - 保存する変換マップオブジェクト。
 */
export function setConversionMap(map) {
  if (!isChromeAPI()) {
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
    return;
  }
  chrome.storage.local.set({ targetTags: tags });
}

export async function getHistory() {
  if (!isChromeAPI()) {
    return [];
  }
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionHistory'], result => {
      resolve(result.conversionHistory || []);
    });
  });
}

export async function saveHistoryEntry(entry) {
  if (!isChromeAPI()) {
    return;
  }
  let history = await getHistory();
  history.unshift(entry); // 新しいものを先頭に追加
  if (history.length > 50) { // 履歴は最新50件まで
    history = history.slice(0, 50);
  }
  chrome.storage.local.set({ conversionHistory: history });
}

/**
 * 変換履歴をすべてクリアします。
 */
export function clearHistory() {
  if (!isChromeAPI()) {
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
    if (callback) callback();
    return;
  }
  chrome.storage.local.remove(keys, callback);
}
