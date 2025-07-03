// Unicode文字から通常の記号への変換マップ
const CONVERSION_MAP = {
  '\u02F8': ':',  // U+02F8 MODIFIER LETTER RAISED COLON → コロン
  '\u2024': '.',  // U+2024 ONE DOT LEADER → ピリオド
  '\u2044': '/'   // U+2044 FRACTION SLASH → スラッシュ
};

// 変換対象の文字を正規表現で検索するためのパターン
const UNICODE_PATTERN = /[\u02F8\u2024\u2044]/g;

/**
 * p要素内のテキストを変換する関数
 * @returns {Object} 変換結果 {success: boolean, message: string, count: number}
 */
function convertParagraphText() {
  try {
    // ページ内のすべてのp要素を取得
    const paragraphs = document.querySelectorAll('p');
    let totalConversions = 0;
    
    paragraphs.forEach(paragraph => {
      // テキストノードを再帰的に処理
      const conversions = processTextNodes(paragraph);
      totalConversions += conversions;
    });
    
    return {
      success: true,
      message: '変換が完了しました',
      count: totalConversions
    };
    
  } catch (error) {
    console.error('変換エラー:', error);
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
 * @returns {number} 変換された文字数
 */
function processTextNodes(element) {
  let conversions = 0;
  
  // 子ノードを順次処理
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
    const convertedText = originalText.replace(UNICODE_PATTERN, (match) => {
      conversions++;
      return CONVERSION_MAP[match];
    });
    
    // テキストが変更された場合のみ更新
    if (originalText !== convertedText) {
      textNode.textContent = convertedText;
    }
  });
  
  return conversions;
}

// ポップアップからのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    // pingメッセージに対する応答
    sendResponse({ status: 'ready' });
    return true;
  } else if (request.action === 'convertText') {
    const result = convertParagraphText();
    sendResponse(result);
    return true;
  }
  return true; // 非同期レスポンスを示す
});

// ページ読み込み完了時にコンソールにメッセージを出力（デバッグ用）
console.log('Unicode URL Converter: コンテンツスクリプトが読み込まれました');

