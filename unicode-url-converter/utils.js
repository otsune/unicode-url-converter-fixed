import { getConversionMap } from './storage.js';

/**
 * 変換マップのキー（Unicode文字）から正規表現パターンを作成します。
 * このパターンは、テキスト内の変換対象文字を効率的に見つけるために使用されます。
 * @param {Object} map 変換マップ。キーは変換元のUnicode文字、値は変換先の文字。
 * @returns {RegExp} 変換対象のUnicode文字にマッチする正規表現オブジェクト。
 */
export function createUnicodePattern(map) {
  const keys = Object.keys(map);
  return new RegExp('[' + keys.join('') + ']', 'g');
}

/**
 * 指定された要素内のすべてのテキストノードを走査し、変換マップに基づいてテキストを変換します。
 * @param {Element} element 処理対象のDOM要素。
 * @param {Object} map 変換マップ。キーは変換元のUnicode文字、値は変換先の文字。
 * @param {RegExp} pattern 変換対象のUnicode文字にマッチする正規表現オブジェクト。
 * @returns {number} 実行された変換の総数。
 */
export function processTextNodes(element, map, pattern) {
  let conversions = 0;
  const TEXT_NODE_FILTER = NodeFilter.SHOW_TEXT; // テキストノードのみを対象とするフィルター
  const walker = document.createTreeWalker(
    element,
    TEXT_NODE_FILTER,
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
