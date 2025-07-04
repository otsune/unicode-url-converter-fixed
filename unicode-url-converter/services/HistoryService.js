/**
 * 履歴サービス
 * 変換履歴の管理とデータ分析を担当
 */
import { createSuccess, createFailure, safeExecute } from '../common.js';

export class HistoryService {
  constructor(storageService) {
    this.storage = storageService;
    this.maxEntries = 50;
  }

  /**
   * 履歴エントリを作成
   * @param {string} url - URL
   * @param {number} count - 変換数
   * @param {Object} [metadata] - 追加のメタデータ
   * @returns {Object} 履歴エントリ
   */
  createEntry(url, count, metadata = {}) {
    return {
      id: this.generateEntryId(),
      url,
      count,
      date: new Date().toISOString(),
      hostname: this.extractHostname(url),
      ...metadata
    };
  }

  /**
   * 履歴エントリのユニークIDを生成
   * @returns {string} ユニークID
   */
  generateEntryId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * URLからホスト名を抽出
   * @param {string} url - URL
   * @returns {string} ホスト名
   */
  extractHostname(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * 履歴にエントリを追加
   * @param {string} url - URL
   * @param {number} count - 変換数
   * @param {Object} [metadata] - 追加のメタデータ
   * @returns {Promise<Object>} 操作結果
   */
  async addEntry(url, count, metadata = {}) {
    return safeExecute(async () => {
      if (!url || typeof count !== 'number' || count < 0) {
        throw new Error('Invalid entry parameters');
      }

      const entry = this.createEntry(url, count, metadata);
      const result = await this.storage.addHistoryEntry(entry);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        entry,
        totalEntries: result.data.historyLength
      };
    }, 'Failed to add history entry');
  }

  /**
   * 履歴を取得
   * @param {Object} [options] - 取得オプション
   * @param {number} [options.limit] - 取得件数制限
   * @param {string} [options.hostname] - ホスト名フィルター
   * @param {Date} [options.since] - 指定日時以降
   * @returns {Promise<Object>} 履歴データ
   */
  async getHistory(options = {}) {
    return safeExecute(async () => {
      const allHistory = await this.storage.getHistory();
      let filteredHistory = [...allHistory];

      // ホスト名フィルター
      if (options.hostname) {
        filteredHistory = filteredHistory.filter(
          entry => entry.hostname === options.hostname
        );
      }

      // 日時フィルター
      if (options.since) {
        const sinceTime = options.since.getTime();
        filteredHistory = filteredHistory.filter(
          entry => new Date(entry.date).getTime() >= sinceTime
        );
      }

      // 件数制限
      if (options.limit && options.limit > 0) {
        filteredHistory = filteredHistory.slice(0, options.limit);
      }

      return {
        entries: filteredHistory,
        total: allHistory.length,
        filtered: filteredHistory.length
      };
    }, 'Failed to get history');
  }

  /**
   * 履歴をクリア
   * @returns {Promise<Object>} 操作結果
   */
  async clearHistory() {
    return safeExecute(async () => {
      const result = await this.storage.clearHistory();
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return { cleared: true };
    }, 'Failed to clear history');
  }

  /**
   * 履歴統計を取得
   * @param {number} [days=30] - 過去の日数
   * @returns {Promise<Object>} 統計データ
   */
  async getStatistics(days = 30) {
    return safeExecute(async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      const historyResult = await this.getHistory({ since });
      if (!historyResult.success) {
        throw new Error(historyResult.message);
      }

      const entries = historyResult.data.entries;
      
      // 基本統計
      const totalConversions = entries.reduce((sum, entry) => sum + entry.count, 0);
      const uniqueHostnames = new Set(entries.map(entry => entry.hostname)).size;
      
      // ホスト名別統計
      const hostnameStats = {};
      entries.forEach(entry => {
        if (!hostnameStats[entry.hostname]) {
          hostnameStats[entry.hostname] = {
            hostname: entry.hostname,
            visits: 0,
            conversions: 0,
            lastVisit: entry.date
          };
        }
        
        hostnameStats[entry.hostname].visits++;
        hostnameStats[entry.hostname].conversions += entry.count;
        
        // より新しい訪問日時を記録
        if (entry.date > hostnameStats[entry.hostname].lastVisit) {
          hostnameStats[entry.hostname].lastVisit = entry.date;
        }
      });

      // 日別統計
      const dailyStats = {};
      entries.forEach(entry => {
        const date = new Date(entry.date).toDateString();
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            visits: 0,
            conversions: 0
          };
        }
        
        dailyStats[date].visits++;
        dailyStats[date].conversions += entry.count;
      });

      return {
        period: {
          days,
          from: since.toISOString(),
          to: new Date().toISOString()
        },
        summary: {
          totalEntries: entries.length,
          totalConversions,
          uniqueHostnames,
          averageConversionsPerEntry: entries.length > 0 ? 
            Math.round(totalConversions / entries.length * 100) / 100 : 0
        },
        byHostname: Object.values(hostnameStats)
          .sort((a, b) => b.conversions - a.conversions),
        byDay: Object.values(dailyStats)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      };
    }, 'Failed to generate statistics');
  }

  /**
   * 履歴をエクスポート用形式に変換
   * @param {string} [format='json'] - エクスポート形式
   * @returns {Promise<Object>} エクスポートデータ
   */
  async exportHistory(format = 'json') {
    return safeExecute(async () => {
      const historyResult = await this.getHistory();
      if (!historyResult.success) {
        throw new Error(historyResult.message);
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        totalEntries: historyResult.data.total,
        entries: historyResult.data.entries
      };

      switch (format.toLowerCase()) {
        case 'json':
          return {
            data: JSON.stringify(exportData, null, 2),
            filename: `unicode-converter-history-${new Date().toISOString().split('T')[0]}.json`,
            mimeType: 'application/json'
          };
          
        case 'csv':
          const csvData = this.convertToCSV(historyResult.data.entries);
          return {
            data: csvData,
            filename: `unicode-converter-history-${new Date().toISOString().split('T')[0]}.csv`,
            mimeType: 'text/csv'
          };
          
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    }, 'Failed to export history');
  }

  /**
   * 履歴データをCSV形式に変換
   * @param {Array} entries - 履歴エントリ配列
   * @returns {string} CSV文字列
   */
  convertToCSV(entries) {
    const headers = ['Date', 'URL', 'Hostname', 'Conversions'];
    const rows = entries.map(entry => [
      new Date(entry.date).toLocaleString(),
      entry.url,
      entry.hostname,
      entry.count
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}