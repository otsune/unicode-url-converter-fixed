import { getConversionMap } from './storage.js';

export function createUnicodePattern(map) {
  const keys = Object.keys(map);
  return new RegExp('[' + keys.join('') + ']', 'g');
}

export function processTextNodes(element, map, pattern) {
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
