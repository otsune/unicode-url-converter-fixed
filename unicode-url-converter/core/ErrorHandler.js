/**
 * 統一エラーハンドラー
 * アプリケーション全体のエラー処理とログを管理
 */
import { createError, createFailure } from '../common.js';

export class ErrorHandler {
  constructor() {
    this.errorCategories = {
      VALIDATION: 'validation',
      NETWORK: 'network', 
      STORAGE: 'storage',
      DOM: 'dom',
      PERMISSION: 'permission',
      UNKNOWN: 'unknown'
    };

    this.logLevel = this.getLogLevel();
    this.errorHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * ログレベルを取得
   * @returns {string} ログレベル
   * @private
   */
  getLogLevel() {
    // 開発環境では詳細ログ、本番環境では最小ログ
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return 'debug';
    }
    return 'error';
  }

  /**
   * エラーを分類
   * @param {Error} error - エラーオブジェクト
   * @returns {string} エラーカテゴリ
   */
  categorizeError(error) {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('validation') || message.includes('invalid')) {
      return this.errorCategories.VALIDATION;
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return this.errorCategories.NETWORK;
    }
    
    if (message.includes('storage') || message.includes('chrome.storage')) {
      return this.errorCategories.STORAGE;
    }
    
    if (message.includes('element') || message.includes('dom') || message.includes('queryselector')) {
      return this.errorCategories.DOM;
    }
    
    if (message.includes('permission') || message.includes('access') || message.includes('denied')) {
      return this.errorCategories.PERMISSION;
    }
    
    return this.errorCategories.UNKNOWN;
  }

  /**
   * ユーザー向けエラーメッセージを生成
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @returns {string} ユーザー向けメッセージ
   */
  getUserMessage(error, context = '') {
    const category = this.categorizeError(error);
    
    const userMessages = {
      [this.errorCategories.VALIDATION]: 'Please check your input and try again.',
      [this.errorCategories.NETWORK]: 'Network error occurred. Please check your connection and try again.',
      [this.errorCategories.STORAGE]: 'Failed to save settings. Please try again.',
      [this.errorCategories.DOM]: 'Interface error occurred. Please refresh the page.',
      [this.errorCategories.PERMISSION]: 'Permission denied. Please check extension permissions.',
      [this.errorCategories.UNKNOWN]: 'An unexpected error occurred. Please try again.'
    };
    
    const baseMessage = userMessages[category];
    return context ? `${context}: ${baseMessage}` : baseMessage;
  }

  /**
   * エラーをログに記録
   * @param {Error} error - エラーオブジェクト
   * @param {string} [context=''] - エラーコンテキスト
   * @param {Object} [metadata={}] - 追加のメタデータ
   */
  logError(error, context = '', metadata = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      category: this.categorizeError(error),
      context,
      message: error.message,
      stack: error.stack,
      metadata
    };
    
    // エラー履歴に追加
    this.errorHistory.push(errorEntry);
    
    // 履歴サイズ制限
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
    
    // コンソール出力（ログレベルに応じて）
    if (this.shouldLog('error')) {
      console.error(`[${errorEntry.category.toUpperCase()}] ${context}:`, error);
      
      if (this.shouldLog('debug') && metadata && Object.keys(metadata).length > 0) {
        console.debug('Error metadata:', metadata);
      }
    }
  }

  /**
   * 警告をログに記録
   * @param {string} message - 警告メッセージ
   * @param {string} [context=''] - コンテキスト
   * @param {Object} [metadata={}] - 追加のメタデータ
   */
  logWarning(message, context = '', metadata = {}) {
    if (this.shouldLog('warning')) {
      console.warn(`[WARNING] ${context}: ${message}`);
      
      if (this.shouldLog('debug') && metadata && Object.keys(metadata).length > 0) {
        console.debug('Warning metadata:', metadata);
      }
    }
  }

  /**
   * 情報をログに記録
   * @param {string} message - 情報メッセージ
   * @param {string} [context=''] - コンテキスト
   * @param {Object} [metadata={}] - 追加のメタデータ
   */
  logInfo(message, context = '', metadata = {}) {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${context}: ${message}`);
      
      if (this.shouldLog('debug') && metadata && Object.keys(metadata).length > 0) {
        console.debug('Info metadata:', metadata);
      }
    }
  }

  /**
   * デバッグ情報をログに記録
   * @param {string} message - デバッグメッセージ
   * @param {string} [context=''] - コンテキスト
   * @param {Object} [metadata={}] - 追加のメタデータ
   */
  logDebug(message, context = '', metadata = {}) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${context}: ${message}`);
      
      if (metadata && Object.keys(metadata).length > 0) {
        console.debug('Debug metadata:', metadata);
      }
    }
  }

  /**
   * 指定されたレベルでログ出力すべきかチェック
   * @param {string} level - ログレベル
   * @returns {boolean} ログ出力するかどうか
   * @private
   */
  shouldLog(level) {
    const levels = ['error', 'warning', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex <= currentLevelIndex;
  }

  /**
   * エラーをレポート用形式に変換
   * @param {Error} error - エラーオブジェクト
   * @param {string} [context=''] - コンテキスト
   * @param {Object} [metadata={}] - 追加のメタデータ
   * @returns {Object} レポート形式のエラー
   */
  createErrorReport(error, context = '', metadata = {}) {
    return createError(
      this.categorizeError(error),
      this.getUserMessage(error, context),
      {
        originalMessage: error.message,
        stack: error.stack,
        context,
        ...metadata
      }
    );
  }

  /**
   * 非同期処理を安全に実行
   * @param {Function} asyncFn - 実行する非同期関数
   * @param {string} [context=''] - エラーコンテキスト
   * @param {Object} [options={}] - オプション
   * @returns {Promise<Object>} 実行結果
   */
  async safeExecute(asyncFn, context = '', options = {}) {
    try {
      const result = await asyncFn();
      
      if (options.logSuccess) {
        this.logInfo('Operation completed successfully', context);
      }
      
      return { success: true, data: result };
    } catch (error) {
      this.logError(error, context, options.metadata);
      
      return createFailure(
        this.getUserMessage(error, context),
        this.createErrorReport(error, context, options.metadata)
      );
    }
  }

  /**
   * エラー統計を取得
   * @param {number} [hours=24] - 過去の時間数
   * @returns {Object} エラー統計
   */
  getErrorStatistics(hours = 24) {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errorHistory.filter(
      error => new Date(error.timestamp) > cutoffTime
    );
    
    const categoryStats = {};
    recentErrors.forEach(error => {
      categoryStats[error.category] = (categoryStats[error.category] || 0) + 1;
    });
    
    return {
      totalErrors: recentErrors.length,
      period: `${hours} hours`,
      byCategory: categoryStats,
      recentErrors: recentErrors.slice(-5) // 最新5件
    };
  }

  /**
   * エラー履歴をクリア
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.logInfo('Error history cleared', 'ErrorHandler');
  }

  /**
   * グローバルエラーハンドラーを設定
   */
  setupGlobalHandlers() {
    // 未捕獲のエラー
    window.addEventListener('error', (event) => {
      this.logError(event.error || new Error(event.message), 'Global Error Handler', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // 未処理のPromise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        event.reason instanceof Error ? event.reason : new Error(event.reason),
        'Unhandled Promise Rejection'
      );
    });
  }
}

// シングルトンインスタンス
export const errorHandler = new ErrorHandler();