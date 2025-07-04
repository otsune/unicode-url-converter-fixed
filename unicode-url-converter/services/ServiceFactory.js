/**
 * サービスファクトリー
 * 依存関係注入コンテナの設定と初期化を担当
 */
import { DependencyContainer } from './DependencyContainer.js';
import { StorageService } from './StorageService.js';
import { MessageService } from './MessageService.js';
import { HistoryService } from './HistoryService.js';

/**
 * アプリケーションのサービスコンテナを作成・設定
 * @returns {DependencyContainer} 設定済みのDIコンテナ
 */
export function createServiceContainer() {
  const container = new DependencyContainer();

  // ストレージサービス（シングルトン）
  container.registerSingleton('storageService', () => {
    return new StorageService();
  });

  // メッセージサービス（シングルトン）
  container.registerSingleton('messageService', () => {
    return new MessageService();
  });

  // 履歴サービス（シングルトン、ストレージサービスに依存）
  container.registerSingleton('historyService', (storageService) => {
    return new HistoryService(storageService);
  }, ['storageService']);

  // 循環依存チェック
  const cyclicDeps = container.findCyclicDependencies();
  if (cyclicDeps.length > 0) {
    throw new Error(`Cyclic dependencies detected: ${cyclicDeps.join(', ')}`);
  }

  return container;
}

/**
 * グローバルサービスコンテナ
 * アプリケーション全体で使用される単一のコンテナインスタンス
 */
let globalContainer = null;

/**
 * グローバルサービスコンテナを取得
 * 初回呼び出し時に作成される
 * @returns {DependencyContainer} グローバルコンテナ
 */
export function getServiceContainer() {
  if (!globalContainer) {
    globalContainer = createServiceContainer();
  }
  return globalContainer;
}

/**
 * グローバルサービスコンテナをリセット
 * 主にテスト時に使用
 */
export function resetServiceContainer() {
  if (globalContainer) {
    globalContainer.clear();
  }
  globalContainer = null;
}

/**
 * サービスを直接取得するヘルパー関数
 * @param {string} serviceName - サービス名
 * @returns {*} サービスインスタンス
 */
export function getService(serviceName) {
  const container = getServiceContainer();
  return container.resolve(serviceName);
}

/**
 * よく使用されるサービスへの便利なアクセサー
 */
export const Services = {
  /**
   * ストレージサービスを取得
   * @returns {StorageService}
   */
  get storage() {
    return getService('storageService');
  },

  /**
   * メッセージサービスを取得
   * @returns {MessageService}
   */
  get message() {
    return getService('messageService');
  },

  /**
   * 履歴サービスを取得
   * @returns {HistoryService}
   */
  get history() {
    return getService('historyService');
  }
};

/**
 * サービスコンテナの状態を検証
 * @returns {Object} 検証結果
 */
export function validateServiceContainer() {
  try {
    const container = getServiceContainer();
    const debugInfo = container.getDebugInfo();
    
    const issues = [];
    
    // 循環依存チェック
    if (debugInfo.cyclicDependencies.length > 0) {
      issues.push({
        type: 'CYCLIC_DEPENDENCY',
        services: debugInfo.cyclicDependencies,
        message: 'Cyclic dependencies detected'
      });
    }
    
    // 依存関係の存在チェック
    for (const [serviceName, serviceInfo] of Object.entries(debugInfo.services)) {
      for (const dependency of serviceInfo.dependencies) {
        if (!debugInfo.services[dependency]) {
          issues.push({
            type: 'MISSING_DEPENDENCY',
            service: serviceName,
            dependency,
            message: `Service '${serviceName}' depends on missing service '${dependency}'`
          });
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      debugInfo
    };
  } catch (error) {
    return {
      valid: false,
      issues: [{
        type: 'CONTAINER_ERROR',
        message: error.message
      }],
      debugInfo: null
    };
  }
}

/**
 * 開発用：サービスコンテナの詳細情報を出力
 */
export function logServiceContainerInfo() {
  if (typeof console !== 'undefined' && console.group) {
    const validation = validateServiceContainer();
    
    console.group('🏭 Service Container Info');
    console.log('Valid:', validation.valid);
    
    if (validation.debugInfo) {
      console.log('Total Services:', validation.debugInfo.totalServices);
      console.log('Active Singletons:', validation.debugInfo.singletons);
      console.log('Resolution Order:', validation.debugInfo.resolutionOrder);
      
      if (validation.issues.length > 0) {
        console.group('⚠️ Issues');
        validation.issues.forEach((issue, index) => {
          console.log(`${index + 1}. ${issue.type}: ${issue.message}`);
        });
        console.groupEnd();
      }
      
      console.group('📊 Service Details');
      console.table(validation.debugInfo.services);
      console.groupEnd();
    }
    
    console.groupEnd();
  }
}