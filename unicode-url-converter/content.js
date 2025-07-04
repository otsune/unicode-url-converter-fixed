// Chrome拡張機能のcontent scriptではimportが使えないため、直接実装

// デフォルトの変換マップ
const DEFAULT_CONVERSION_MAP = {
  '\u02F8': ':',
  '\u2024': '.',
  '\u2044': '/'
};

// Chrome APIの利用可能性チェック
function isChromeAPI() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

// デフォルトの変換マップを取得
function getDefaultConversionMap() {
  return DEFAULT_CONVERSION_MAP;
}

// Unicode文字のパターンを作成
function createUnicodePattern(map) {
  const keys = Object.keys(map);
  if (keys.length === 0) {
    return new RegExp('[]', 'g'); // 空のパターン
  }
  // 特殊文字をエスケープ
  const escapedKeys = keys.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`[${escapedKeys.join('')}]`, 'g');
}

// テキストノードを処理して変換を実行
function processTextNodes(element, map, pattern) {
  let conversions = 0;
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  textNodes.forEach(textNode => {
    const originalText = textNode.textContent;
    const convertedText = originalText.replace(pattern, (match) => {
      conversions++;
      return map[match] || match;
    });
    
    if (originalText !== convertedText) {
      textNode.textContent = convertedText;
    }
  });
  
  return conversions;
}

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


