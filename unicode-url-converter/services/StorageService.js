/**
 * ストレージサービス
 * Chrome extension storage APIの抽象化とデータ管理を担当
 */
import { isChromeAPI, getDefaultConversionMap, createSuccess, createFailure, safeExecute } from '../common.js';

export class StorageService {
  constructor() {
    this.storageKeys = {
      CONVERSION_MAP: 'conversionMap',
      TARGET_TAGS: 'targetTags',
      CONVERSION_HISTORY: 'conversionHistory'
    };
    
    this.defaultValues = {
      [this.storageKeys.CONVERSION_MAP]: getDefaultConversionMap(),
      [this.storageKeys.TARGET_TAGS]: 'p',
      [this.storageKeys.CONVERSION_HISTORY]: []
    };
    
    this.maxHistoryEntries = 50;
  }

  /**
   * Chrome storage APIが利用可能かチェック
   * @returns {boolean}
   */
  isAvailable() {
    return isChromeAPI();
  }

  /**
   * ストレージからデータを取得
   * @param {string} key - 取得するキー
   * @returns {Promise<*>} 取得されたデータ
   */
  async get(key) {
    if (!this.isAvailable()) {
      return this.defaultValues[key];
    }

    return new Promise(resolve => {
      chrome.storage.local.get([key], result => {
        resolve(result[key] || this.defaultValues[key]);
      });
    });
  }

  /**
   * ストレージにデータを保存
   * @param {string} key - 保存するキー
   * @param {*} value - 保存する値
   * @returns {Promise<Object>} 操作結果
   */
  async set(key, value) {
    return safeExecute(async () => {
      if (!this.isAvailable()) {
        throw new Error('Chrome storage API not available');
      }

      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ key, value });
          }
        });
      });
    }, `Failed to save ${key} to storage`);
  }

  /**
   * ストレージからデータを削除
   * @param {string|string[]} keys - 削除するキー
   * @returns {Promise<Object>} 操作結果
   */
  async remove(keys) {
    return safeExecute(async () => {
      if (!this.isAvailable()) {
        throw new Error('Chrome storage API not available');
      }

      return new Promise((resolve, reject) => {
        chrome.storage.local.remove(keys, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({ removedKeys: keys });
          }
        });
      });
    }, 'Failed to remove data from storage');
  }

  /**
   * 変換マップを取得
   * @returns {Promise<Object>} 変換マップ
   */
  async getConversionMap() {
    return this.get(this.storageKeys.CONVERSION_MAP);
  }

  /**
   * 変換マップを保存
   * @param {Object} map - 変換マップ
   * @returns {Promise<Object>} 操作結果
   */
  async setConversionMap(map) {
    return this.set(this.storageKeys.CONVERSION_MAP, map);
  }

  /**
   * 対象タグを取得
   * @returns {Promise<string>} 対象タグセレクタ
   */
  async getTargetTags() {
    return this.get(this.storageKeys.TARGET_TAGS);
  }

  /**
   * 対象タグを保存
   * @param {string} tags - 対象タグセレクタ
   * @returns {Promise<Object>} 操作結果
   */
  async setTargetTags(tags) {
    return this.set(this.storageKeys.TARGET_TAGS, tags);
  }

  /**
   * 変換履歴を取得
   * @returns {Promise<Array>} 変換履歴配列
   */
  async getHistory() {
    return this.get(this.storageKeys.CONVERSION_HISTORY);
  }

  /**
   * 変換履歴にエントリを追加
   * @param {Object} entry - 履歴エントリ
   * @param {string} entry.url - URL
   * @param {number} entry.count - 変換数
   * @param {string} entry.date - 日時
   * @returns {Promise<Object>} 操作結果
   */
  async addHistoryEntry(entry) {
    return safeExecute(async () => {
      const history = await this.getHistory();
      
      // 新しいエントリを先頭に追加
      const updatedHistory = [entry, ...history];
      
      // 最大件数を超えた場合は古いものを削除
      if (updatedHistory.length > this.maxHistoryEntries) {
        updatedHistory.splice(this.maxHistoryEntries);
      }
      
      const result = await this.set(this.storageKeys.CONVERSION_HISTORY, updatedHistory);
      return { ...result.data, historyLength: updatedHistory.length };
    }, 'Failed to add history entry');
  }

  /**
   * 変換履歴をクリア
   * @returns {Promise<Object>} 操作結果
   */
  async clearHistory() {
    return this.set(this.storageKeys.CONVERSION_HISTORY, []);
  }

  /**
   * 設定をリセット（デフォルト値に戻す）
   * @returns {Promise<Object>} 操作結果
   */
  async resetSettings() {
    return safeExecute(async () => {
      const results = await Promise.all([
        this.setConversionMap(this.defaultValues[this.storageKeys.CONVERSION_MAP]),
        this.setTargetTags(this.defaultValues[this.storageKeys.TARGET_TAGS])
      ]);
      
      return { resetItems: ['conversionMap', 'targetTags'] };
    }, 'Failed to reset settings');
  }

  /**
   * ストレージ使用量を取得（利用可能な場合）
   * @returns {Promise<Object>} ストレージ使用量情報
   */
  async getStorageInfo() {
    return safeExecute(async () => {
      if (!this.isAvailable() || !chrome.storage.local.getBytesInUse) {
        throw new Error('Storage info not available');
      }

      return new Promise((resolve, reject) => {
        chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve({
              bytesInUse,
              quotaBytes: chrome.storage.local.QUOTA_BYTES || 'Unknown'
            });
          }
        });
      });
    }, 'Failed to get storage info');
  }
}