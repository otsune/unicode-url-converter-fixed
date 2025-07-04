/**
 * 変換コントローラー
 * Unicode文字変換処理のビジネスロジックを制御
 */
import { createSuccess, createFailure, safeExecute } from '../common.js';

export class ConversionController {
  constructor(messageService, storageService, historyService) {
    this.messageService = messageService;
    this.storageService = storageService;
    this.historyService = historyService;
  }

  /**
   * 変換処理を実行
   * @param {Object} [options] - 変換オプション
   * @param {string} [options.targetTags] - 対象タグセレクタ（省略時はストレージから取得）
   * @param {boolean} [options.saveHistory=true] - 履歴保存するかどうか
   * @returns {Promise<Object>} 変換結果
   */
  async executeConversion(options = {}) {
    return safeExecute(async () => {
      // アクティブタブを取得
      const tabResult = await this.messageService.getActiveTab();
      if (!tabResult.success) {
        throw new Error(tabResult.message);
      }

      const tab = tabResult.data;

      // タブのURLを検証
      const validationResult = this.messageService.validateTab(tab);
      if (!validationResult.success) {
        throw new Error(validationResult.message);
      }

      // 対象タグを取得
      const targetTags = options.targetTags || await this.storageService.getTargetTags();

      // 変換実行
      const conversionResult = await this.messageService.convertText(tab.id, targetTags);
      if (!conversionResult.success) {
        throw new Error(conversionResult.message);
      }

      const result = conversionResult.data;

      // 履歴保存（変換が発生した場合のみ）
      if (options.saveHistory !== false && result.success && result.count > 0) {
        try {
          await this.historyService.addEntry(tab.url, result.count, {
            targetTags,
            tabTitle: tab.title
          });
        } catch (historyError) {
          // 履歴保存の失敗は変換処理自体の失敗にはしない
          console.warn('Failed to save history:', historyError);
        }
      }

      return {
        success: result.success,
        message: result.message,
        count: result.count || 0,
        url: tab.url,
        title: tab.title,
        targetTags,
        timestamp: new Date().toISOString()
      };
    }, 'Conversion process failed');
  }

  /**
   * 変換設定を取得
   * @returns {Promise<Object>} 変換設定
   */
  async getConversionSettings() {
    return safeExecute(async () => {
      const [conversionMap, targetTags] = await Promise.all([
        this.storageService.getConversionMap(),
        this.storageService.getTargetTags()
      ]);

      return {
        conversionMap,
        targetTags,
        mapSize: Object.keys(conversionMap).length
      };
    }, 'Failed to get conversion settings');
  }

  /**
   * 変換設定を更新
   * @param {Object} settings - 更新する設定
   * @param {Object} [settings.conversionMap] - 変換マップ
   * @param {string} [settings.targetTags] - 対象タグ
   * @returns {Promise<Object>} 更新結果
   */
  async updateConversionSettings(settings) {
    return safeExecute(async () => {
      const updates = [];

      if (settings.conversionMap) {
        // 変換マップの妥当性チェック
        const validationResult = this.validateConversionMap(settings.conversionMap);
        if (!validationResult.valid) {
          throw new Error(`Invalid conversion map: ${validationResult.errors.join(', ')}`);
        }

        const result = await this.storageService.setConversionMap(settings.conversionMap);
        if (result.success) {
          updates.push('conversionMap');
        }
      }

      if (settings.targetTags) {
        // タグセレクタの妥当性チェック
        const validationResult = this.validateTargetTags(settings.targetTags);
        if (!validationResult.valid) {
          throw new Error(`Invalid target tags: ${validationResult.errors.join(', ')}`);
        }

        const result = await this.storageService.setTargetTags(settings.targetTags);
        if (result.success) {
          updates.push('targetTags');
        }
      }

      return {
        updatedSettings: updates,
        timestamp: new Date().toISOString()
      };
    }, 'Failed to update conversion settings');
  }

  /**
   * 変換マップの妥当性を検証
   * @param {Object} conversionMap - 変換マップ
   * @returns {Object} 検証結果
   */
  validateConversionMap(conversionMap) {
    const errors = [];

    if (!conversionMap || typeof conversionMap !== 'object') {
      errors.push('Conversion map must be an object');
      return { valid: false, errors };
    }

    for (const [unicode, replacement] of Object.entries(conversionMap)) {
      // Unicodeキーの形式チェック
      if (!/^\\u[0-9A-Fa-f]{4}$/.test(unicode)) {
        errors.push(`Invalid Unicode format: ${unicode}`);
      }

      // 置換文字の妥当性チェック
      if (typeof replacement !== 'string' || replacement.length !== 1) {
        errors.push(`Replacement must be a single character: ${unicode} -> ${replacement}`);
      }
    }

    // 重複する置換文字チェック
    const replacements = Object.values(conversionMap);
    const uniqueReplacements = new Set(replacements);
    if (replacements.length !== uniqueReplacements.size) {
      errors.push('Duplicate replacement characters found');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 対象タグセレクタの妥当性を検証
   * @param {string} targetTags - 対象タグセレクタ
   * @returns {Object} 検証結果
   */
  validateTargetTags(targetTags) {
    const errors = [];

    if (typeof targetTags !== 'string' || !targetTags.trim()) {
      errors.push('Target tags must be a non-empty string');
      return { valid: false, errors };
    }

    // CSSセレクタの基本的な妥当性チェック
    try {
      // ダミー要素でセレクタをテスト
      const testElement = document.createElement('div');
      testElement.innerHTML = '<p>test</p><div>test</div>';
      testElement.querySelectorAll(targetTags.trim());
    } catch (error) {
      errors.push(`Invalid CSS selector: ${targetTags}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 変換マップをリセット（デフォルトに戻す）
   * @returns {Promise<Object>} リセット結果
   */
  async resetConversionMap() {
    return safeExecute(async () => {
      const result = await this.storageService.resetSettings();
      if (!result.success) {
        throw new Error(result.message);
      }

      return {
        reset: true,
        resetItems: result.data.resetItems,
        timestamp: new Date().toISOString()
      };
    }, 'Failed to reset conversion settings');
  }

  /**
   * 変換プレビューを生成（実際の変換は行わない）
   * @param {string} sampleText - サンプルテキスト
   * @param {Object} [conversionMap] - 使用する変換マップ（省略時は現在の設定を使用）
   * @returns {Promise<Object>} プレビュー結果
   */
  async generatePreview(sampleText, conversionMap = null) {
    return safeExecute(async () => {
      if (!sampleText || typeof sampleText !== 'string') {
        throw new Error('Sample text is required');
      }

      const map = conversionMap || await this.storageService.getConversionMap();
      
      // パターン作成
      const keys = Object.keys(map);
      const pattern = new RegExp('[' + keys.join('') + ']', 'g');
      
      // 変換実行
      let convertedText = sampleText;
      let conversions = 0;
      const changedPositions = [];

      convertedText = sampleText.replace(pattern, (match, offset) => {
        conversions++;
        changedPositions.push({
          position: offset,
          original: match,
          replacement: map[match] || match
        });
        return map[match] || match;
      });

      return {
        original: sampleText,
        converted: convertedText,
        conversions,
        changes: changedPositions,
        hasChanges: sampleText !== convertedText
      };
    }, 'Failed to generate preview');
  }

  /**
   * 変換統計を取得
   * @param {number} [days=30] - 過去の日数
   * @returns {Promise<Object>} 統計情報
   */
  async getConversionStatistics(days = 30) {
    return safeExecute(async () => {
      const statsResult = await this.historyService.getStatistics(days);
      if (!statsResult.success) {
        throw new Error(statsResult.message);
      }

      const settings = await this.getConversionSettings();
      if (!settings.success) {
        throw new Error(settings.message);
      }

      return {
        ...statsResult.data,
        currentSettings: settings.data
      };
    }, 'Failed to get conversion statistics');
  }
}