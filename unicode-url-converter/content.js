// Unicode文字から通常の記号への変換マップ
const CONVERSION_MAP = {
  '\u02F8': ':',  // U+02F8 MODIFIER LETTER RAISED COLON → コロン
  '\u2024': '.',  // U+2024 ONE DOT LEADER → ピリオド
  '\u2044': '/'   // U+2044 FRACTION SLASH → スラッシュ
};

// 変換対象の文字を正規表現で検索するためのパターン
const UNICODE_PATTERN = /[\u02F8\u2024\u2044]/g;

// chrome.storageから変換マップを取得するPromise
function getConversionMap() {
  return new Promise(resolve => {
    chrome.storage.local.get(['conversionMap'], result => {
      if (result.conversionMap) {
        resolve(result.conversionMap);
      } else {
        resolve({
          '\u02F8': ':',
          '\u2024': '.',
          '\u2044': '/'
        });
      }
    });
  });
}

// 変換対象の文字を正規表現で検索するためのパターンを生成
function createUnicodePattern(map) {
  const keys = Object.keys(map).map(k => String.fromCharCode(parseInt(k.replace('\\u',''),16)));
  return new RegExp('[' + keys.join('') + ']', 'g');
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
        message: `セレクタ「${selector}」に一致する要素が見つかりませんでした。`,
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
      message: '変換が完了しました',
      count: totalConversions
    };
  } catch (error) {
    console.error('変換エラー:', error);
    if (error instanceof DOMException && error.name === 'SyntaxError') {
        return {
            success: false,
            message: `無効なセレクタです: ${selector}`,
            count: 0
        };
    }
    return {
      success: false,
      message: '変換中にエラーが発生しました: ' + error.message,
      count: 0
    };
  }
}

/**
 * 指定された要素内のテキストノードを再帰的に処理して文字を変換
 * @param {Element} element 処理対象の要素
 * @param {Object} map 変換マップ
 * @param {RegExp} pattern 正規表現
 * @returns {number} 変換された文字数
 */
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
      const key = '\\u' + match.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0');
      conversions++;
      return map[key] || match;
    });
    if (originalText !== convertedText) {
      textNode.textContent = convertedText;
    }
  });
  return conversions;
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
console.log('Unicode URL Converter: コンテンツスクリプトが読み込まれました');

