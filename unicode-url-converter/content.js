// utils.jsから変換機能をインポート
import { createUnicodePattern, processTextNodes } from './utils.js';
import { isChromeAPI, getDefaultConversionMap } from './common.js';

// 変換マップを取得する関数
async function getConversionMap() {
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


