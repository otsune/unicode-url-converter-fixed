import { createUnicodePattern, processTextNodes } from './utils.js';

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

/**
 * 変換マップを非同期で取得します。
 * Chromeストレージに保存されたカスタムマップがあればそれを、なければデフォルトマップを使用します。
 * @returns {Promise<Object>} 変換マップを解決するPromise。
 */
async function getConversionMap() {
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
 * 指定されたセレクタに一致する要素内のテキストを変換する関数（非同期）
 * @param {string} selector 変換対象の要素を指定するCSSセレクタ
 * @returns {Promise<Object>} 変換結果 {success: boolean, message: string, count: number}
 */
async function convertTextAsync(selector = 'p') {
  try {
    const map = await getConversionMap();
    const pattern = createUnicodePattern(map);
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      return {
        success: true,
        message: chrome.i18n.getMessage('contentNoElements', [selector]),
        count: 0
      };
    }
    let totalConversions = 0;
    elements.forEach(element => {
      const conversions = processTextNodes(element, map, pattern);
      totalConversions += conversions;
    });
    return {
      success: true,
      message: chrome.i18n.getMessage('contentConversionComplete'),
      count: totalConversions
    };
  } catch (error) {
    console.error(chrome.i18n.getMessage('consoleConversionError'), error);
    if (error instanceof DOMException && error.name === 'SyntaxError') {
        return {
            success: false,
            message: chrome.i18n.getMessage('contentInvalidSelector', [selector]),
            count: 0
        };
    }
    return {
      success: false,
      message: chrome.i18n.getMessage('contentConversionError', [error.message]),
      count: 0
    };
  }
}

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ready' });
    return true;
  } else if (request.action === 'convertText') {
    convertTextAsync(request.tags).then(result => sendResponse(result));
    return true;
  }
  return true;
});

// ページ読み込み完了時にコンソールにメッセージを出力（デバッグ用）
console.log(chrome.i18n.getMessage('contentScriptLoaded'));

