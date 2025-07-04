/**
 * UIレンダラー
 * DOM操作を抽象化し、新しいサービスレイヤーと連携
 */
import { Services } from '../services/ServiceFactory.js';
import { isChromeI18n } from '../common.js';

export class UIRenderer {
  constructor() {
    // ステータス表示のタイマー管理
    this.statusTimer = null;
    this.sortableInstance = null;
  }

  /**
   * 国際化メッセージを取得
   * @param {string} key - メッセージキー
   * @param {Array} [substitutions=[]] - 置換値
   * @returns {string} ローカライズされたメッセージ
   */
  getMessage(key, substitutions = []) {
    if (!isChromeI18n()) {
      // デフォルトメッセージ（英語）
      const defaultMessages = {
        'popupTitle': 'Unicode URL Converter',
        'convertButton': 'Convert Text',
        'customizeTitle': 'Customize Conversion Characters',
        'addButton': 'Add',
        'exportButton': 'Export',
        'importButton': 'Import',
        'editButton': 'Edit',
        'deleteButton': 'Delete',
        'historyTitle': 'Conversion History',
        'clearHistoryButton': 'Clear History',
        'addUnicodePlaceholder': 'e.g., ˸',
        'addReplacePlaceholder': ':',
        'statusSuccess': 'Conversion complete: $count$ characters converted.',
        'statusNoMatch': 'No target characters found.',
        'historyEmpty': 'No history yet.',
        'historyEntry': 'Converted $count$ characters',
        'alertDuplicateUnicode': 'This Unicode character has already been added.',
        'alertInvalidChar': 'Please enter a single character for the replacement.',
        'statusHistoryCleared': 'History cleared.',
        'example_info': 'Example:',
        'example_list': '˸ (U+02F8) → :<br>․ (U+2024) → .<br>⁄ (U+2044) → /'
      };
      
      let message = defaultMessages[key] || key;
      
      // Chrome i18n形式のプレースホルダーを処理
      if (substitutions.length > 0) {
        substitutions.forEach((sub, index) => {
          message = message.replace(`$${index + 1}`, sub);
          message = message.replace(`$count$`, sub);
        });
      }
      return message;
    }
    return chrome.i18n.getMessage(key, substitutions);
  }

  /**
   * HTML要素の国際化処理
   */
  localizeHtml() {
    // data-i18n属性を持つ要素を処理
    document.querySelectorAll('[data-i18n]').forEach(elem => {
      const msg = this.getMessage(elem.dataset.i18n);
      if (msg) elem.innerHTML = msg;
    });
    
    // data-i18n-placeholder属性を持つ要素を処理
    document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
      const msg = this.getMessage(elem.dataset.i18nPlaceholder);
      if (msg) elem.placeholder = msg;
    });
  }

  /**
   * ステータスメッセージを表示
   * @param {boolean} success - 成功フラグ
   * @param {string} message - メッセージ
   * @param {number} [count=0] - 変換数
   */
  showStatus(success, message, count = 0) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    // 既存のタイマーをクリア（メモリリーク対策）
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    
    statusDiv.style.display = 'block';
    statusDiv.className = 'status ' + (success ? 'success' : 'error');
    
    if (success && count > 0) {
      statusDiv.textContent = this.getMessage('statusSuccess', [count.toString()]);
    } else if (success && count === 0) {
      statusDiv.textContent = this.getMessage('statusNoMatch');
    } else {
      statusDiv.textContent = message;
    }
    
    // タイマーを管理してメモリリークを防止
    this.statusTimer = setTimeout(() => {
      statusDiv.style.display = 'none';
      this.statusTimer = null;
    }, 3000);
  }

  /**
   * 変換リストをレンダリング
   */
  async renderConversionList() {
    try {
      const map = await Services.storage.getConversionMap();
      const list = document.getElementById('conversionList');
      if (!list) return;
      
      // DocumentFragmentを使用してバッチ更新
      const fragment = document.createDocumentFragment();
      
      Object.entries(map).forEach(([unicode, replace]) => {
        const li = this.createConversionListItem(unicode, replace);
        fragment.appendChild(li);
      });
      
      // 一括でDOM更新（パフォーマンス向上）
      list.replaceChildren(fragment);
    } catch (error) {
      this.showStatus(false, `Failed to render conversion list: ${error.message}`);
    }
  }

  /**
   * 変換リストアイテムを作成
   * @param {string} unicode - Unicode文字キー
   * @param {string} replace - 置換文字
   * @returns {HTMLElement} リストアイテム要素
   * @private
   */
  createConversionListItem(unicode, replace) {
    const li = document.createElement('li');
    li.dataset.key = unicode;
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.marginBottom = '4px';
    li.style.cursor = 'grab';
    
    const codePoint = unicode.replace('\\u', 'U+');
    
    // XSS対策：安全なDOM要素作成
    const unicodeSpan = document.createElement('span');
    unicodeSpan.style.width = '80px';
    unicodeSpan.style.textAlign = 'center';
    unicodeSpan.textContent = `${String.fromCharCode(parseInt(unicode.replace('\\u',''),16))} (${codePoint})`;
    
    const arrowSpan = document.createElement('span');
    arrowSpan.style.width = '30px';
    arrowSpan.style.textAlign = 'center';
    arrowSpan.textContent = '→';
    
    const replaceSpan = document.createElement('span');
    replaceSpan.style.width = '30px';
    replaceSpan.style.textAlign = 'center';
    replaceSpan.textContent = replace; // ユーザー入力の安全な表示
    
    const editBtn = document.createElement('button');
    editBtn.className = 'editBtn';
    editBtn.dataset.key = unicode;
    editBtn.style.marginLeft = '8px';
    editBtn.textContent = this.getMessage('editButton');
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'deleteBtn';
    deleteBtn.dataset.key = unicode;
    deleteBtn.style.marginLeft = '4px';
    deleteBtn.textContent = this.getMessage('deleteButton');
    
    // 要素を組み立て
    li.appendChild(unicodeSpan);
    li.appendChild(arrowSpan);
    li.appendChild(replaceSpan);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    
    return li;
  }

  /**
   * 変換履歴をレンダリング
   */
  async renderHistory() {
    try {
      const historyResult = await Services.history.getHistory({ limit: 20 });
      if (!historyResult.success) {
        throw new Error(historyResult.message);
      }
      
      const history = historyResult.data.entries;
      const historyList = document.getElementById('historyList');
      if (!historyList) return;
      
      // 履歴が空の場合
      if (history.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.textContent = this.getMessage('historyEmpty');
        historyList.replaceChildren(emptyLi);
        return;
      }
      
      // DocumentFragmentを使用してバッチ更新
      const fragment = document.createDocumentFragment();
      
      history.forEach(entry => {
        const li = this.createHistoryListItem(entry);
        fragment.appendChild(li);
      });
      
      // 一括でDOM更新
      historyList.replaceChildren(fragment);
    } catch (error) {
      this.showStatus(false, `Failed to render history: ${error.message}`);
    }
  }

  /**
   * 履歴リストアイテムを作成
   * @param {Object} entry - 履歴エントリ
   * @returns {HTMLElement} リストアイテム要素
   * @private
   */
  createHistoryListItem(entry) {
    const li = document.createElement('li');
    li.style.fontSize = '12px';
    li.style.marginBottom = '4px';
    
    // XSS対策：安全なDOM要素作成
    const urlDiv = document.createElement('div');
    urlDiv.title = entry.url; // title属性は安全
    urlDiv.style.whiteSpace = 'nowrap';
    urlDiv.style.overflow = 'hidden';
    urlDiv.style.textOverflow = 'ellipsis';
    urlDiv.textContent = entry.hostname || new URL(entry.url).hostname; // 安全なテキスト表示
    
    const detailDiv = document.createElement('div');
    detailDiv.style.color = '#666';
    detailDiv.textContent = `${this.getMessage('historyEntry', [entry.count.toString()])} - ${new Date(entry.date).toLocaleString()}`;
    
    li.appendChild(urlDiv);
    li.appendChild(detailDiv);
    
    return li;
  }

  /**
   * ソート可能リストを初期化
   * @param {HTMLElement} sortableList - ソート対象の要素
   */
  initSortableList(sortableList) {
    if (typeof Sortable === 'undefined' || !sortableList) {
      return;
    }
    
    // 既存のSortableインスタンスがあれば破棄
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
    }
    
    this.sortableInstance = new Sortable(sortableList, {
      animation: 150,
      onEnd: async (evt) => {
        try {
          const newOrder = Array.from(evt.target.children).map(item => item.dataset.key);
          const currentMap = await Services.storage.getConversionMap();
          
          const newMap = {};
          newOrder.forEach(key => {
            if (currentMap[key]) {
              newMap[key] = currentMap[key];
            }
          });
          
          await Services.storage.setConversionMap(newMap);
        } catch (error) {
          this.showStatus(false, `Failed to save order: ${error.message}`);
        }
      }
    });
  }

  /**
   * プログレス表示を開始
   * @param {string} message - プログレスメッセージ
   */
  showProgress(message) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.style.display = 'block';
    statusDiv.className = 'status progress';
    statusDiv.textContent = message;
  }

  /**
   * プログレス表示を終了
   */
  hideProgress() {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }
  }

  /**
   * 確認ダイアログを表示
   * @param {string} message - 確認メッセージ
   * @returns {boolean} ユーザーの選択結果
   */
  confirm(message) {
    return window.confirm(message);
  }

  /**
   * プロンプトダイアログを表示
   * @param {string} message - プロンプトメッセージ
   * @param {string} [defaultValue=''] - デフォルト値
   * @returns {string|null} ユーザーの入力値（キャンセル時はnull）
   */
  prompt(message, defaultValue = '') {
    return window.prompt(message, defaultValue);
  }

  /**
   * DOM要素を安全に取得
   * @param {string} id - 要素ID
   * @returns {HTMLElement|null} DOM要素
   */
  getElementById(id) {
    return document.getElementById(id);
  }

  /**
   * ファイルダウンロードを実行
   * @param {string} data - ダウンロードするデータ
   * @param {string} filename - ファイル名
   * @param {string} [mimeType='application/json'] - MIMEタイプ
   */
  downloadFile(data, filename, mimeType = 'application/json') {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * リソースクリーンアップ
   */
  cleanup() {
    // タイマーのクリーンアップ
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    
    // Sortableインスタンスのクリーンアップ
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
      this.sortableInstance = null;
    }
  }
}