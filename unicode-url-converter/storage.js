const DEFAULT_MAP = {
  '\u02F8': ':',
  '\u2024': '.',
  '\u2044': '/'
};

export async function getConversionMap() {
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionMap'], result => {
      resolve(result.conversionMap || DEFAULT_MAP);
    });
  });
}

export function setConversionMap(map) {
  chrome.storage.local.set({ conversionMap: map });
}

export async function getTargetTags() {
  return new Promise(resolve => {
    chrome.storage.local.get(['targetTags'], result => {
      resolve(result.targetTags || 'p');
    });
  });
}

export function setTargetTags(tags) {
  chrome.storage.local.set({ targetTags: tags });
}

export async function getHistory() {
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionHistory'], result => {
      resolve(result.conversionHistory || []);
    });
  });
}

export async function saveHistoryEntry(entry) {
  let history = await getHistory();
  history.unshift(entry); // 新しいものを先頭に追加
  if (history.length > 50) { // 履歴は最新50件まで
    history = history.slice(0, 50);
  }
  chrome.storage.local.set({ conversionHistory: history });
}

export function clearHistory() {
  chrome.storage.local.set({ conversionHistory: [] });
}

export function removeSettings(keys, callback) {
  chrome.storage.local.remove(keys, callback);
}
