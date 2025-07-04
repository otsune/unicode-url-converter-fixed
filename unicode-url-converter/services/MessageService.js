/**
 * メッセージサービス
 * Chrome extension messaging APIの抽象化とコンテンツスクリプト通信を担当
 */
import { createSuccess, createFailure, safeExecute, delay, isUrlAllowed } from '../common.js';

export class MessageService {
  constructor() {
    this.messageActions = {
      PING: 'ping',
      CONVERT_TEXT: 'convertText'
    };
    
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 200, // ミリ秒
      maxDelay: 1000
    };
  }

  /**
   * Chrome tabs APIが利用可能かチェック
   * @returns {boolean}
   */
  isAvailable() {
    return typeof chrome !== 'undefined' && 
           chrome.tabs && 
           chrome.scripting;
  }

  /**
   * アクティブなタブを取得
   * @returns {Promise<Object>} タブ情報
   */
  async getActiveTab() {
    return safeExecute(async () => {
      if (!this.isAvailable()) {
        throw new Error('Chrome tabs API not available');
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      return tab;
    }, 'Failed to get active tab');
  }

  /**
   * タブのURLが処理可能かチェック
   * @param {Object} tab - タブオブジェクト
   * @returns {Object} 検証結果
   */
  validateTab(tab) {
    if (!tab || !tab.url) {
      return createFailure('Invalid tab or URL');
    }

    if (!isUrlAllowed(tab.url)) {
      return createFailure('URL not allowed for conversion', {
        url: tab.url,
        reason: 'Invalid protocol or restricted page'
      });
    }

    return createSuccess(tab);
  }

  /**
   * コンテンツスクリプトにメッセージを送信
   * @param {number} tabId - タブID
   * @param {Object} message - 送信するメッセージ
   * @param {number} [timeout=5000] - タイムアウト時間（ミリ秒）
   * @returns {Promise<Object>} レスポンス
   */
  async sendMessage(tabId, message, timeout = 5000) {
    return safeExecute(async () => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeout}ms`));
        }, timeout);

        chrome.tabs.sendMessage(tabId, message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }, 'Failed to send message to content script');
  }

  /**
   * コンテンツスクリプトに接続確認を送信
   * @param {number} tabId - タブID
   * @returns {Promise<Object>} 接続確認結果
   */
  async pingContentScript(tabId) {
    const result = await this.sendMessage(tabId, { 
      action: this.messageActions.PING 
    }, 2000);
    
    if (result.success && result.data && result.data.status === 'ready') {
      return createSuccess(true, 'Content script is ready');
    }
    
    return createFailure('Content script not ready or invalid response');
  }

  /**
   * コンテンツスクリプトをタブに注入
   * @param {number} tabId - タブID
   * @returns {Promise<Object>} 注入結果
   */
  async injectContentScript(tabId) {
    return safeExecute(async () => {
      if (!this.isAvailable()) {
        throw new Error('Chrome scripting API not available');
      }

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });

      return { injected: true, tabId };
    }, 'Failed to inject content script');
  }

  /**
   * コンテンツスクリプトの準備を確認し、必要に応じて注入
   * @param {number} tabId - タブID
   * @returns {Promise<Object>} 準備確認結果
   */
  async ensureContentScript(tabId) {
    const { maxRetries, baseDelay } = this.retryConfig;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 接続確認
        const pingResult = await this.pingContentScript(tabId);
        if (pingResult.success) {
          return createSuccess(true, 'Content script is ready');
        }
        
        lastError = new Error(pingResult.message);
      } catch (error) {
        lastError = error;
      }

      // 最後の試行でない場合は注入とリトライ
      if (attempt < maxRetries) {
        try {
          // コンテンツスクリプトを注入
          await this.injectContentScript(tabId);
          
          // 段階的な待機時間
          const waitTime = Math.min(baseDelay * attempt, this.retryConfig.maxDelay);
          await delay(waitTime);
        } catch (injectError) {
          lastError = injectError;
        }
      }
    }

    return createFailure(
      `Failed to establish content script connection after ${maxRetries} attempts`,
      lastError
    );
  }

  /**
   * テキスト変換を実行
   * @param {number} tabId - タブID
   * @param {string} targetTags - 対象タグセレクタ
   * @returns {Promise<Object>} 変換結果
   */
  async convertText(tabId, targetTags) {
    return safeExecute(async () => {
      // コンテンツスクリプトの準備確認
      const ensureResult = await this.ensureContentScript(tabId);
      if (!ensureResult.success) {
        throw new Error(ensureResult.message);
      }

      // 変換実行
      const result = await this.sendMessage(tabId, {
        action: this.messageActions.CONVERT_TEXT,
        tags: targetTags
      });

      if (!result.success) {
        throw new Error(result.message || 'Conversion failed');
      }

      return result.data;
    }, 'Failed to convert text');
  }

  /**
   * エラーメッセージを適切な形式に変換
   * @param {Error} error - エラーオブジェクト
   * @returns {Object} 分類されたエラー情報
   */
  categorizeError(error) {
    const message = error.message || '';
    
    if (message.includes('Could not establish connection')) {
      return {
        type: 'CONNECTION_FAILED',
        userMessage: 'Could not connect to the page. Please refresh and try again.',
        technical: message
      };
    }
    
    if (message.includes('Cannot access contents of url')) {
      return {
        type: 'ACCESS_DENIED',
        userMessage: 'Cannot access this page. Extension permissions may be required.',
        technical: message
      };
    }
    
    if (message.includes('timeout')) {
      return {
        type: 'TIMEOUT',
        userMessage: 'The operation timed out. Please try again.',
        technical: message
      };
    }
    
    return {
      type: 'UNKNOWN',
      userMessage: 'An unexpected error occurred. Please try again.',
      technical: message
    };
  }
}