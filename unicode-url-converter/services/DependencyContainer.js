/**
 * 依存関係注入コンテナ
 * アプリケーション全体の依存関係を管理し、サービスのライフサイクルを制御
 */

export class DependencyContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
  }

  /**
   * サービスをシングルトンとして登録
   * @param {string} name - サービス名
   * @param {Function} factory - サービス作成関数
   * @param {Array} [dependencies=[]] - 依存関係配列
   */
  registerSingleton(name, factory, dependencies = []) {
    this.services.set(name, {
      type: 'singleton',
      factory,
      dependencies,
      instance: null
    });
  }

  /**
   * サービスをトランジェントとして登録（毎回新しいインスタンスを作成）
   * @param {string} name - サービス名
   * @param {Function} factory - サービス作成関数
   * @param {Array} [dependencies=[]] - 依存関係配列
   */
  registerTransient(name, factory, dependencies = []) {
    this.services.set(name, {
      type: 'transient',
      factory,
      dependencies,
      instance: null
    });
  }

  /**
   * インスタンスを直接登録
   * @param {string} name - サービス名
   * @param {*} instance - インスタンス
   */
  registerInstance(name, instance) {
    this.services.set(name, {
      type: 'instance',
      instance,
      dependencies: []
    });
  }

  /**
   * サービスを取得
   * @param {string} name - サービス名
   * @returns {*} サービスインスタンス
   */
  resolve(name) {
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }

    // インスタンス直接登録の場合
    if (service.type === 'instance') {
      return service.instance;
    }

    // シングルトンで既にインスタンスが存在する場合
    if (service.type === 'singleton' && service.instance) {
      return service.instance;
    }

    // 依存関係を解決
    const dependencies = service.dependencies.map(dep => this.resolve(dep));
    
    // インスタンス作成
    const instance = service.factory(...dependencies);

    // シングルトンの場合はインスタンスを保存
    if (service.type === 'singleton') {
      service.instance = instance;
      this.singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * サービスが登録されているかチェック
   * @param {string} name - サービス名
   * @returns {boolean} 登録されている場合はtrue
   */
  isRegistered(name) {
    return this.services.has(name);
  }

  /**
   * サービスを削除
   * @param {string} name - サービス名
   * @returns {boolean} 削除できた場合はtrue
   */
  unregister(name) {
    const removed = this.services.delete(name);
    this.singletons.delete(name);
    return removed;
  }

  /**
   * 全てのサービスをクリア
   */
  clear() {
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }

  /**
   * 登録されているサービス一覧を取得
   * @returns {Array<string>} サービス名配列
   */
  getRegisteredServices() {
    return Array.from(this.services.keys());
  }

  /**
   * サービスの依存関係グラフを取得
   * @returns {Object} 依存関係マップ
   */
  getDependencyGraph() {
    const graph = {};
    
    for (const [name, service] of this.services) {
      graph[name] = {
        type: service.type,
        dependencies: service.dependencies,
        hasInstance: service.instance !== null
      };
    }
    
    return graph;
  }

  /**
   * 循環依存をチェック
   * @param {string} serviceName - チェックするサービス名
   * @param {Set} [visited=new Set()] - 訪問済みサービス
   * @param {Set} [recursionStack=new Set()] - 再帰スタック
   * @returns {boolean} 循環依存がある場合はtrue
   */
  hasCyclicDependency(serviceName, visited = new Set(), recursionStack = new Set()) {
    if (!this.services.has(serviceName)) {
      return false;
    }

    visited.add(serviceName);
    recursionStack.add(serviceName);

    const service = this.services.get(serviceName);
    
    for (const dependency of service.dependencies) {
      if (!visited.has(dependency)) {
        if (this.hasCyclicDependency(dependency, visited, recursionStack)) {
          return true;
        }
      } else if (recursionStack.has(dependency)) {
        return true; // 循環依存を検出
      }
    }

    recursionStack.delete(serviceName);
    return false;
  }

  /**
   * 全てのサービスの循環依存をチェック
   * @returns {Array<string>} 循環依存のあるサービス名配列
   */
  findCyclicDependencies() {
    const cyclicServices = [];
    
    for (const serviceName of this.services.keys()) {
      if (this.hasCyclicDependency(serviceName)) {
        cyclicServices.push(serviceName);
      }
    }
    
    return cyclicServices;
  }

  /**
   * サービスの依存関係を解決する順序を取得（トポロジカルソート）
   * @returns {Array<string>} 解決順序配列
   */
  getResolutionOrder() {
    const visited = new Set();
    const order = [];
    
    const visit = (serviceName) => {
      if (visited.has(serviceName)) {
        return;
      }
      
      visited.add(serviceName);
      
      const service = this.services.get(serviceName);
      if (service) {
        // 依存関係を先に訪問
        for (const dependency of service.dependencies) {
          visit(dependency);
        }
      }
      
      order.push(serviceName);
    };
    
    // 全てのサービスを訪問
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }
    
    return order;
  }

  /**
   * デバッグ情報を取得
   * @returns {Object} デバッグ情報
   */
  getDebugInfo() {
    return {
      totalServices: this.services.size,
      singletons: this.singletons.size,
      services: this.getDependencyGraph(),
      resolutionOrder: this.getResolutionOrder(),
      cyclicDependencies: this.findCyclicDependencies()
    };
  }
}