const DEFAULT_MAP = {
  '\u02F8': ':',
  '\u2024': '.',
  '\u2044': '/'
};

// chrome APIが利用可能かチェック
function isChromeAPI() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
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

export function setConversionMap(map) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  chrome.storage.local.set({ conversionMap: map });
}

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

export function setTargetTags(tags) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
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
    console.warn('Chrome storage API not available');
    return;
  }
  let history = await getHistory();
  history.unshift(entry); // 新しいものを先頭に追加
  if (history.length > 50) { // 履歴は最新50件まで
    history = history.slice(0, 50);
  }
  chrome.storage.local.set({ conversionHistory: history });
}

export function clearHistory() {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    return;
  }
  chrome.storage.local.set({ conversionHistory: [] });
}

export function removeSettings(keys, callback) {
  if (!isChromeAPI()) {
    console.warn('Chrome storage API not available');
    if (callback) callback();
    return;
  }
  chrome.storage.local.remove(keys, callback);
}
