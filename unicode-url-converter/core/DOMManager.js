/**
 * DOM操作マネージャー
 * DOM操作を抽象化し、テスト可能性を向上させる
 */
export class DOMManager {
  constructor(document = window.document) {
    this.document = document;
    this.eventListeners = new Map(); // イベントリスナー管理
  }

  /**
   * 要素を取得
   * @param {string} selector - CSSセレクタ
   * @returns {Element|null} DOM要素
   */
  querySelector(selector) {
    try {
      return this.document.querySelector(selector);
    } catch (error) {
      throw new Error(`Invalid selector: ${selector}`);
    }
  }

  /**
   * 複数の要素を取得
   * @param {string} selector - CSSセレクタ
   * @returns {NodeList} DOM要素リスト
   */
  querySelectorAll(selector) {
    try {
      return this.document.querySelectorAll(selector);
    } catch (error) {
      throw new Error(`Invalid selector: ${selector}`);
    }
  }

  /**
   * IDで要素を取得
   * @param {string} id - 要素ID
   * @returns {Element|null} DOM要素
   */
  getElementById(id) {
    return this.document.getElementById(id);
  }

  /**
   * 要素を作成
   * @param {string} tagName - タグ名
   * @param {Object} [attributes={}] - 属性
   * @param {string} [textContent=''] - テキスト内容
   * @returns {Element} 作成された要素
   */
  createElement(tagName, attributes = {}, textContent = '') {
    const element = this.document.createElement(tagName);
    
    // 属性を設定
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });
    
    // テキスト内容を設定
    if (textContent) {
      element.textContent = textContent;
    }
    
    return element;
  }

  /**
   * DocumentFragmentを作成
   * @returns {DocumentFragment} ドキュメントフラグメント
   */
  createDocumentFragment() {
    return this.document.createDocumentFragment();
  }

  /**
   * 要素にイベントリスナーを追加
   * @param {Element} element - 対象要素
   * @param {string} eventType - イベントタイプ
   * @param {Function} handler - ハンドラー関数
   * @param {Object} [options={}] - イベントオプション
   */
  addEventListener(element, eventType, handler, options = {}) {
    element.addEventListener(eventType, handler, options);
    
    // イベントリスナー管理のために記録
    const key = `${element.id || 'anonymous'}-${eventType}`;
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key).push({ element, eventType, handler, options });
  }

  /**
   * 要素からイベントリスナーを削除
   * @param {Element} element - 対象要素
   * @param {string} eventType - イベントタイプ
   * @param {Function} handler - ハンドラー関数
   */
  removeEventListener(element, eventType, handler) {
    element.removeEventListener(eventType, handler);
    
    // 管理記録からも削除
    const key = `${element.id || 'anonymous'}-${eventType}`;
    const listeners = this.eventListeners.get(key);
    if (listeners) {
      const index = listeners.findIndex(l => l.handler === handler);
      if (index !== -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.eventListeners.delete(key);
        }
      }
    }
  }

  /**
   * 要素の可視性を設定
   * @param {Element} element - 対象要素
   * @param {boolean} visible - 表示するかどうか
   */
  setVisible(element, visible) {
    if (!element) return;
    element.style.display = visible ? 'block' : 'none';
  }

  /**
   * 要素のクラスを追加
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   */
  addClass(element, className) {
    if (element && className) {
      element.classList.add(className);
    }
  }

  /**
   * 要素のクラスを削除
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   */
  removeClass(element, className) {
    if (element && className) {
      element.classList.remove(className);
    }
  }

  /**
   * 要素のクラスをトグル
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   * @returns {boolean} クラスが追加されたかどうか
   */
  toggleClass(element, className) {
    if (element && className) {
      return element.classList.toggle(className);
    }
    return false;
  }

  /**
   * 要素のクラスが存在するかチェック
   * @param {Element} element - 対象要素
   * @param {string} className - クラス名
   * @returns {boolean} クラスが存在するかどうか
   */
  hasClass(element, className) {
    return element && className ? element.classList.contains(className) : false;
  }

  /**
   * 要素のテキスト内容を安全に設定
   * @param {Element} element - 対象要素
   * @param {string} text - テキスト内容
   */
  setTextContent(element, text) {
    if (element) {
      element.textContent = text || '';
    }
  }

  /**
   * 要素のHTML内容を安全に設定
   * @param {Element} element - 対象要素
   * @param {string} html - HTML内容
   */
  setInnerHTML(element, html) {
    if (element) {
      // XSS対策: 基本的なサニタイゼーション
      const sanitized = this.sanitizeHTML(html);
      element.innerHTML = sanitized;
    }
  }

  /**
   * HTMLの基本的なサニタイゼーション
   * @param {string} html - HTML文字列
   * @returns {string} サニタイズされたHTML
   * @private
   */
  sanitizeHTML(html) {
    // 基本的なXSS対策（より高度なサニタイゼーションが必要な場合は専用ライブラリを使用）
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * 要素の子要素をすべて置換
   * @param {Element} element - 対象要素
   * @param {Node|DocumentFragment} newContent - 新しい内容
   */
  replaceChildren(element, newContent) {
    if (element) {
      if (element.replaceChildren) {
        // モダンブラウザ
        element.replaceChildren(newContent);
      } else {
        // レガシーブラウザサポート
        while (element.firstChild) {
          element.removeChild(element.firstChild);
        }
        if (newContent) {
          element.appendChild(newContent);
        }
      }
    }
  }

  /**
   * 要素の属性を安全に設定
   * @param {Element} element - 対象要素
   * @param {string} name - 属性名
   * @param {string} value - 属性値
   */
  setAttribute(element, name, value) {
    if (element && name) {
      element.setAttribute(name, value || '');
    }
  }

  /**
   * 要素の属性を取得
   * @param {Element} element - 対象要素
   * @param {string} name - 属性名
   * @returns {string|null} 属性値
   */
  getAttribute(element, name) {
    return element && name ? element.getAttribute(name) : null;
  }

  /**
   * 要素の属性を削除
   * @param {Element} element - 対象要素
   * @param {string} name - 属性名
   */
  removeAttribute(element, name) {
    if (element && name) {
      element.removeAttribute(name);
    }
  }

  /**
   * ファイルダウンロードを実行
   * @param {string} data - ダウンロードするデータ
   * @param {string} filename - ファイル名
   * @param {string} [mimeType='text/plain'] - MIMEタイプ
   */
  downloadFile(data, filename, mimeType = 'text/plain') {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = this.createElement('a', {
      href: url,
      download: filename,
      style: { display: 'none' }
    });
    
    this.document.body.appendChild(a);
    a.click();
    
    // クリーンアップ
    setTimeout(() => {
      this.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 要素が存在するかチェック
   * @param {Element} element - チェックする要素
   * @returns {boolean} 要素が存在するかどうか
   */
  exists(element) {
    return element !== null && element !== undefined;
  }

  /**
   * 要素が表示されているかチェック
   * @param {Element} element - チェックする要素
   * @returns {boolean} 要素が表示されているかどうか
   */
  isVisible(element) {
    if (!this.exists(element)) return false;
    
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }

  /**
   * 全てのイベントリスナーをクリーンアップ
   */
  cleanup() {
    for (const [key, listeners] of this.eventListeners) {
      listeners.forEach(({ element, eventType, handler }) => {
        element.removeEventListener(eventType, handler);
      });
    }
    this.eventListeners.clear();
  }

  /**
   * イベントリスナーの統計を取得
   * @returns {Object} 統計情報
   */
  getEventListenerStats() {
    const stats = {};
    let totalListeners = 0;
    
    for (const [key, listeners] of this.eventListeners) {
      stats[key] = listeners.length;
      totalListeners += listeners.length;
    }
    
    return {
      totalListeners,
      byElement: stats
    };
  }
}