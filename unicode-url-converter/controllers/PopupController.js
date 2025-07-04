/**
 * ポップアップコントローラー
 * ポップアップUIのイベント処理とビジネスロジックの調整を担当
 */
import { createSuccess, createFailure, safeExecute } from '../common.js';

export class PopupController {
  constructor(conversionController, storageService, historyService, uiRenderer) {
    this.conversionController = conversionController;
    this.storageService = storageService;
    this.historyService = historyService;
    this.uiRenderer = uiRenderer;
    
    // UIイベントハンドラーをバインド
    this.handleConvert = this.handleConvert.bind(this);
    this.handleAddConversion = this.handleAddConversion.bind(this);
    this.handleEditConversion = this.handleEditConversion.bind(this);
    this.handleDeleteConversion = this.handleDeleteConversion.bind(this);
    this.handleImportSettings = this.handleImportSettings.bind(this);
    this.handleExportSettings = this.handleExportSettings.bind(this);
    this.handleClearHistory = this.handleClearHistory.bind(this);
    
    this.isInitialized = false;
  }

  /**
   * ポップアップを初期化
   * @returns {Promise<Object>} 初期化結果
   */
  async initialize() {
    return safeExecute(async () => {
      if (this.isInitialized) {
        throw new Error('PopupController is already initialized');
      }

      // UI要素の存在チェックとイベントリスナー設定
      await this.setupEventListeners();
      
      // 初期データの読み込みと表示
      await this.loadInitialData();
      
      this.isInitialized = true;
      
      return {
        initialized: true,
        timestamp: new Date().toISOString()
      };
    }, 'Failed to initialize popup controller');
  }

  /**
   * イベントリスナーを設定
   * @private
   */
  async setupEventListeners() {
    const elements = {
      convertBtn: document.getElementById('convertBtn'),
      addForm: document.getElementById('addForm'),
      conversionList: document.getElementById('conversionList'),
      importInput: document.getElementById('importInput'),
      exportBtn: document.getElementById('exportBtn'),
      clearHistoryBtn: document.getElementById('clearHistoryBtn')
    };

    // 要素の存在チェック
    const missingElements = Object.entries(elements)
      .filter(([name, element]) => !element)
      .map(([name]) => name);

    if (missingElements.length > 0) {
      throw new Error(`Missing UI elements: ${missingElements.join(', ')}`);
    }

    // イベントリスナー設定
    if (elements.convertBtn) {
      elements.convertBtn.addEventListener('click', this.handleConvert);
    }

    if (elements.addForm) {
      elements.addForm.addEventListener('submit', this.handleAddConversion);
    }

    if (elements.conversionList) {
      elements.conversionList.addEventListener('click', this.handleConversionListClick.bind(this));
    }

    if (elements.importInput) {
      elements.importInput.addEventListener('change', this.handleImportSettings);
    }

    if (elements.exportBtn) {
      elements.exportBtn.addEventListener('click', this.handleExportSettings);
    }

    if (elements.clearHistoryBtn) {
      elements.clearHistoryBtn.addEventListener('click', this.handleClearHistory);
    }
  }

  /**
   * 初期データを読み込み、UIに表示
   * @private
   */
  async loadInitialData() {
    // 変換リスト表示
    await this.refreshConversionList();
    
    // 履歴表示
    await this.refreshHistory();
    
    // ソート機能初期化
    this.uiRenderer.initSortableList(document.getElementById('conversionList'));
  }

  /**
   * 変換ボタンクリック処理
   * @param {Event} event - クリックイベント
   */
  async handleConvert(event) {
    event.preventDefault();
    
    try {
      this.uiRenderer.showStatus(true, chrome.i18n.getMessage('statusConverting'), 0);
      
      const result = await this.conversionController.executeConversion();
      
      if (result.success) {
        const data = result.data;
        
        if (data.count > 0) {
          this.uiRenderer.showStatus(true, data.message, data.count);
          // 履歴を更新
          await this.refreshHistory();
        } else {
          this.uiRenderer.showStatus(true, chrome.i18n.getMessage('statusNoTargetChars'), 0);
        }
      } else {
        this.uiRenderer.showStatus(false, result.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorConversionFailed', [error.message]));
    }
  }

  /**
   * 変換文字追加処理
   * @param {Event} event - フォーム送信イベント
   */
  async handleAddConversion(event) {
    event.preventDefault();
    
    try {
      const formData = new FormData(event.target);
      const unicodeChar = formData.get('unicodeInput')?.trim();
      const replaceChar = formData.get('replaceInput')?.trim();
      
      if (!unicodeChar || unicodeChar.length === 0) {
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorUnicodeRequired'));
        return;
      }

      if (!replaceChar || replaceChar.length === 0) {
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorReplacementRequired'));
        return;
      }

      // Unicode文字の検証とキー形式への変換
      let unicodeKey;
      
      // 入力が\uXXXX形式かチェック
      if (/^\\u[0-9A-Fa-f]{4}$/i.test(unicodeChar)) {
        // 既に\uXXXX形式の場合はそのまま使用（大文字に統一）
        unicodeKey = unicodeChar.toLowerCase().replace(/\\u(.{4})/, (match, hex) => 
          '\\u' + hex.toUpperCase()
        );
      } else if (/^U\+[0-9A-Fa-f]{4}$/i.test(unicodeChar)) {
        // U+XXXX形式の場合は\uXXXX形式に変換
        unicodeKey = unicodeChar.toLowerCase().replace(/u\+(.{4})/, (match, hex) => 
          '\\u' + hex.toUpperCase()
        );
      } else if (unicodeChar.length === 1) {
        // 単一文字の場合は\uXXXX形式に変換
        const charCode = unicodeChar.charCodeAt(0);
        
        // ASCII文字（0-127）はUnicode変換対象外として警告
        if (charCode <= 127) {
          this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorAsciiNotAllowed'));
          return;
        }
        
        unicodeKey = '\\u' + charCode.toString(16).toUpperCase().padStart(4, '0');
      } else {
        // 複数文字や無効な形式
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorInvalidUnicodeFormat'));
        return;
      }
      
      // 現在の変換マップを取得
      const currentMap = await this.storageService.getConversionMap();
      
      // 重複チェック
      if (currentMap.hasOwnProperty(unicodeKey)) {
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorCharacterExists'));
        return;
      }

      // 新しいマップを作成
      const newMap = { ...currentMap, [unicodeKey]: replaceChar };
      
      // 設定を更新
      const updateResult = await this.conversionController.updateConversionSettings({
        conversionMap: newMap
      });
      
      if (updateResult.success) {
        event.target.reset();
        await this.refreshConversionList();
        this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successConversionAdded'));
      } else {
        this.uiRenderer.showStatus(false, updateResult.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorAddConversionFailed', [error.message]));
    }
  }

  /**
   * 変換リストクリック処理（編集・削除）
   * @param {Event} event - クリックイベント
   */
  async handleConversionListClick(event) {
    const target = event.target;
    
    if (target.classList.contains('editBtn')) {
      await this.handleEditConversion(target.dataset.key);
    } else if (target.classList.contains('deleteBtn')) {
      await this.handleDeleteConversion(target.dataset.key);
    }
  }

  /**
   * 変換文字編集処理
   * @param {string} unicodeKey - 編集するUnicodeキー
   */
  async handleEditConversion(unicodeKey) {
    try {
      const currentMap = await this.storageService.getConversionMap();
      const currentChar = currentMap[unicodeKey];
      
      const newChar = prompt(chrome.i18n.getMessage('promptEditReplacement'), currentChar);
      if (newChar === null) return; // キャンセル
      
      if (newChar.length !== 1) {
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorReplacementSingleChar'));
        return;
      }

      const newMap = { ...currentMap, [unicodeKey]: newChar };
      
      const updateResult = await this.conversionController.updateConversionSettings({
        conversionMap: newMap
      });
      
      if (updateResult.success) {
        await this.refreshConversionList();
        this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successConversionUpdated'));
      } else {
        this.uiRenderer.showStatus(false, updateResult.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorEditConversionFailed', [error.message]));
    }
  }

  /**
   * 変換文字削除処理
   * @param {string} unicodeKey - 削除するUnicodeキー
   */
  async handleDeleteConversion(unicodeKey) {
    try {
      const currentMap = await this.storageService.getConversionMap();
      const newMap = { ...currentMap };
      delete newMap[unicodeKey];
      
      const updateResult = await this.conversionController.updateConversionSettings({
        conversionMap: newMap
      });
      
      if (updateResult.success) {
        await this.refreshConversionList();
        this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successConversionDeleted'));
      } else {
        this.uiRenderer.showStatus(false, updateResult.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorDeleteConversionFailed', [error.message]));
    }
  }

  /**
   * 設定インポート処理
   * @param {Event} event - ファイル選択イベント
   */
  async handleImportSettings(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const text = await this.readFileAsText(file);
      const importedMap = JSON.parse(text);
      
      // U+XXXX形式を\uXXXX形式に変換してインポート
      const convertedMap = {};
      Object.entries(importedMap).forEach(([key, value]) => {
        let convertedKey = key;
        
        // U+XXXX形式を\uXXXX形式に変換
        if (/^U\+[0-9A-Fa-f]{4}$/i.test(key)) {
          const hexValue = key.substring(2).toUpperCase();
          convertedKey = `\\u${hexValue}`;
        }
        // 実際のUnicode文字を\uXXXX形式に変換
        else if (key.length === 1 && key.charCodeAt(0) > 127) {
          const charCode = key.charCodeAt(0);
          convertedKey = '\\u' + charCode.toString(16).toUpperCase().padStart(4, '0');
        }
        
        convertedMap[convertedKey] = value;
      });

      // インポートデータの検証
      const validation = await this.conversionController.validateConversionMap(convertedMap);
      if (!validation.success || !validation.data.valid) {
        const errors = validation.data?.errors || ['Validation failed'];
        this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorImportFailed', [errors.join(', ')]));
        return;
      }

      const updateResult = await this.conversionController.updateConversionSettings({
        conversionMap: convertedMap
      });
      
      if (updateResult.success) {
        await this.refreshConversionList();
        this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successSettingsImported'));
      } else {
        this.uiRenderer.showStatus(false, updateResult.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorImportFailed', [error.message]));
    }
  }

  /**
   * 設定エクスポート処理
   */
  async handleExportSettings() {
    try {
      const conversionMap = await this.storageService.getConversionMap();
      
      // \uXXXX形式をU+XXXX形式に変換してエクスポート
      const exportMap = {};
      Object.entries(conversionMap).forEach(([unicodeKey, replaceChar]) => {
        let exportKey = unicodeKey;
        
        // \uXXXX形式をU+XXXX形式に変換
        if (/^\\u[0-9A-Fa-f]{4}$/i.test(unicodeKey)) {
          const hexValue = unicodeKey.substring(2).toUpperCase();
          exportKey = `U+${hexValue}`;
        }
        
        exportMap[exportKey] = replaceChar;
      });
      
      const exportData = JSON.stringify(exportMap, null, 2);
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `unicode-converter-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successSettingsExported'));
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorExportFailed', [error.message]));
    }
  }

  /**
   * 履歴クリア処理
   */
  async handleClearHistory() {
    try {
      const result = await this.historyService.clearHistory();
      
      if (result.success) {
        await this.refreshHistory();
        this.uiRenderer.showStatus(true, chrome.i18n.getMessage('successHistoryCleared'));
      } else {
        this.uiRenderer.showStatus(false, result.message);
      }
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorClearHistoryFailed', [error.message]));
    }
  }

  /**
   * 変換リストを更新
   */
  async refreshConversionList() {
    try {
      await this.uiRenderer.renderConversionList();
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorGeneric', [error.message]));
    }
  }

  /**
   * 履歴を更新
   */
  async refreshHistory() {
    try {
      await this.uiRenderer.renderHistory();
    } catch (error) {
      this.uiRenderer.showStatus(false, chrome.i18n.getMessage('errorGeneric', [error.message]));
    }
  }

  /**
   * ファイルをテキストとして読み取り
   * @param {File} file - 読み取るファイル
   * @returns {Promise<string>} ファイル内容
   * @private
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * ポップアップ終了時のクリーンアップ
   */
  cleanup() {
    // タイマーなどのクリーンアップ
    this.uiRenderer.cleanup();
    this.isInitialized = false;
  }
}