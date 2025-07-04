/**
 * 共通ユーティリティモジュール
 * プロジェクト全体で使用される共通機能を提供
 */

/**
 * Chrome拡張APIが利用可能かどうかをチェックします。
 * @returns {boolean} Chrome APIが利用可能な場合はtrue
 */
export function isChromeAPI() {
  return typeof chrome !== 'undefined' &&
         typeof chrome.storage !== 'undefined' &&
         typeof chrome.storage.local !== 'undefined';
}

/**
 * Chrome i18n APIが利用可能かどうかをチェックします。
 * @returns {boolean} Chrome i18n APIが利用可能な場合はtrue
 */
export function isChromeI18n() {
  return typeof chrome !== 'undefined' && 
         typeof chrome.i18n !== 'undefined';
}

/**
 * デフォルトの変換マップを取得します。
 * @returns {Object} デフォルトのUnicode変換マップ
 */
export function getDefaultConversionMap() {
  return {
    '\u02F8': ':',  // U+02F8 MODIFIER LETTER RAISED COLON
    '\u2024': '.',  // U+2024 ONE DOT LEADER
    '\u2044': '/'   // U+2044 FRACTION SLASH
  };
}

/**
 * URLが変換処理を許可されているかを検証します。
 * @param {string} url - 検証するURL
 * @returns {boolean} 変換処理が許可されている場合はtrue
 */
export function isUrlAllowed(url) {
  // ホワイトリスト方式による安全なURL検証
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    
    // 許可されたプロトコル
    const allowedProtocols = ['http:', 'https:'];
    
    // Chrome内部ページや拡張機能ページを除外
    if (protocol === 'chrome:' || 
        protocol === 'chrome-extension:' || 
        protocol === 'moz-extension:' ||
        protocol === 'file:') {
      return false;
    }
    
    return allowedProtocols.includes(protocol);
  } catch (error) {
    // 無効なURLの場合は拒否
    return false;
  }
}

/**
 * エラーメッセージを統一形式で作成します。
 * @param {string} type - エラータイプ
 * @param {string} message - エラーメッセージ
 * @param {Object} [details] - 追加の詳細情報
 * @returns {Object} 統一形式のエラーオブジェクト
 */
export function createError(type, message, details = {}) {
  return {
    type,
    message,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 成功レスポンスを統一形式で作成します。
 * @param {*} data - レスポンスデータ
 * @param {string} [message] - 成功メッセージ
 * @returns {Object} 統一形式の成功レスポンス
 */
export function createSuccess(data, message = '') {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  };
}

/**
 * 失敗レスポンスを統一形式で作成します。
 * @param {string} message - エラーメッセージ
 * @param {*} [error] - エラーオブジェクト
 * @returns {Object} 統一形式の失敗レスポンス
 */
export function createFailure(message, error = null) {
  return {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * 安全にPromiseを実行し、エラーを適切にハンドリングします。
 * @param {Function} asyncFn - 実行する非同期関数
 * @param {string} [errorMessage] - エラー時のメッセージ
 * @returns {Promise<Object>} 成功/失敗の統一レスポンス
 */
export async function safeExecute(asyncFn, errorMessage = 'Operation failed') {
  try {
    const result = await asyncFn();
    return createSuccess(result);
  } catch (error) {
    return createFailure(errorMessage, error);
  }
}

/**
 * 配列を指定されたサイズでバッチに分割します。
 * @param {Array} array - 分割する配列
 * @param {number} batchSize - バッチサイズ
 * @returns {Array<Array>} バッチに分割された配列
 */
export function batchArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 指定された時間だけ待機します。
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>} 待機のPromise
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * オブジェクトのディープクローンを作成します。
 * @param {*} obj - クローンするオブジェクト
 * @returns {*} クローンされたオブジェクト
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}