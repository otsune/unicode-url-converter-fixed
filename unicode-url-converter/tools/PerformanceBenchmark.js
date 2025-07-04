/**
 * パフォーマンス ベンチマーク ツール
 * 新アーキテクチャの性能を測定・比較
 */

export class PerformanceBenchmark {
  constructor() {
    this.results = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * ベンチマーク開始
   * @param {string} label - ベンチマーク名
   */
  start(label) {
    this.startTime = performance.now();
    console.log(`🚀 Benchmark started: ${label}`);
  }

  /**
   * ベンチマーク終了
   * @param {string} label - ベンチマーク名
   */
  end(label) {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    
    const result = {
      label,
      duration: Math.round(duration * 100) / 100,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    console.log(`✅ Benchmark completed: ${label} - ${result.duration}ms`);
    
    return result;
  }

  /**
   * DOM操作パフォーマンステスト
   */
  async testDOMOperations() {
    console.group('🎯 DOM Operations Performance Test');
    
    // テストデータ準備
    const testData = Array.from({ length: 100 }, (_, i) => ({
      unicode: `\\u0${(2000 + i).toString(16).toUpperCase()}`,
      replace: String.fromCharCode(65 + (i % 26))
    }));

    // 従来方式（innerHTML）のシミュレーション
    this.start('Legacy DOM Operations (innerHTML simulation)');
    const legacyContainer = document.createElement('div');
    testData.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${item.unicode}</span><span>${item.replace}</span>`;
      legacyContainer.appendChild(li);
    });
    this.end('Legacy DOM Operations (innerHTML simulation)');

    // 新方式（DocumentFragment + createElement）
    this.start('New DOM Operations (DocumentFragment + createElement)');
    const newContainer = document.createElement('div');
    const fragment = document.createDocumentFragment();
    
    testData.forEach(item => {
      const li = document.createElement('li');
      const span1 = document.createElement('span');
      span1.textContent = item.unicode;
      const span2 = document.createElement('span');
      span2.textContent = item.replace;
      li.appendChild(span1);
      li.appendChild(span2);
      fragment.appendChild(li);
    });
    
    newContainer.appendChild(fragment);
    this.end('New DOM Operations (DocumentFragment + createElement)');

    console.groupEnd();
  }

  /**
   * ストレージ操作パフォーマンステスト
   */
  async testStorageOperations() {
    console.group('💾 Storage Operations Performance Test');
    
    // Mock Chrome Storage for testing
    const mockStorage = {
      data: {},
      get: function(keys, callback) {
        setTimeout(() => {
          const result = {};
          keys.forEach(key => {
            if (this.data[key]) result[key] = this.data[key];
          });
          callback(result);
        }, Math.random() * 10); // Simulate network delay
      },
      set: function(data, callback) {
        setTimeout(() => {
          Object.assign(this.data, data);
          callback();
        }, Math.random() * 10);
      }
    };

    // ストレージ読み取りテスト
    this.start('Storage Read Operations');
    await new Promise(resolve => {
      mockStorage.get(['conversionMap', 'targetTags', 'conversionHistory'], () => {
        resolve();
      });
    });
    this.end('Storage Read Operations');

    // ストレージ書き込みテスト
    const testData = {
      conversionMap: { '\\u02F8': ':', '\\u2024': '.', '\\u2044': '/' },
      targetTags: 'p, div, span',
      conversionHistory: Array.from({ length: 50 }, (_, i) => ({
        url: `https://example${i}.com`,
        count: i,
        date: new Date().toISOString()
      }))
    };

    this.start('Storage Write Operations');
    await new Promise(resolve => {
      mockStorage.set(testData, () => {
        resolve();
      });
    });
    this.end('Storage Write Operations');

    console.groupEnd();
  }

  /**
   * メモリ使用量測定
   */
  measureMemoryUsage() {
    console.group('🧠 Memory Usage Analysis');
    
    if (performance.memory) {
      const memory = performance.memory;
      const memoryInfo = {
        usedJSHeapSize: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalJSHeapSize: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)
      };
      
      console.log('📊 Memory Usage:', memoryInfo);
      this.results.push({
        label: 'Memory Usage',
        memoryInfo,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('⚠️ Memory measurement not available in this environment');
    }
    
    console.groupEnd();
  }

  /**
   * エラーハンドリングパフォーマンステスト
   */
  async testErrorHandling() {
    console.group('🛡️ Error Handling Performance Test');
    
    // Try-catch方式
    this.start('Traditional Try-Catch Error Handling');
    for (let i = 0; i < 1000; i++) {
      try {
        if (Math.random() < 0.1) {
          throw new Error('Test error');
        }
        // Normal operation
        const result = i * 2;
      } catch (error) {
        // Error handling
        const errorMessage = error.message;
      }
    }
    this.end('Traditional Try-Catch Error Handling');

    // SafeExecute方式（統一エラーハンドリング）
    this.start('Unified SafeExecute Error Handling');
    const safeExecute = async (fn) => {
      try {
        const result = await fn();
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    for (let i = 0; i < 1000; i++) {
      await safeExecute(async () => {
        if (Math.random() < 0.1) {
          throw new Error('Test error');
        }
        return i * 2;
      });
    }
    this.end('Unified SafeExecute Error Handling');

    console.groupEnd();
  }

  /**
   * 依存関係注入のオーバーヘッドテスト
   */
  testDependencyInjection() {
    console.group('🔗 Dependency Injection Overhead Test');
    
    // 直接インスタンス化
    this.start('Direct Instantiation');
    for (let i = 0; i < 1000; i++) {
      const service = {
        method: () => i * 2
      };
      service.method();
    }
    this.end('Direct Instantiation');

    // DI コンテナ経由
    this.start('Dependency Injection Container');
    const container = new Map();
    
    // サービス登録
    container.set('testService', () => ({
      method: (value) => value * 2
    }));

    for (let i = 0; i < 1000; i++) {
      const serviceFactory = container.get('testService');
      const service = serviceFactory();
      service.method(i);
    }
    this.end('Dependency Injection Container');

    console.groupEnd();
  }

  /**
   * 包括的パフォーマンステストを実行
   */
  async runComprehensiveTest() {
    console.log('🏁 Starting Comprehensive Performance Test');
    console.log('=' .repeat(50));
    
    const startTime = performance.now();
    
    // DOM要素が存在しない場合は作成
    if (!document.body) {
      document.body = document.createElement('body');
    }

    try {
      await this.testDOMOperations();
      await this.testStorageOperations();
      this.measureMemoryUsage();
      await this.testErrorHandling();
      this.testDependencyInjection();
    } catch (error) {
      console.error('❌ Performance test failed:', error);
    }

    const totalTime = performance.now() - startTime;
    
    console.log('=' .repeat(50));
    console.log(`🎉 Performance Test Completed in ${totalTime.toFixed(2)}ms`);
    console.log('📊 Results Summary:');
    
    this.generateReport();
  }

  /**
   * パフォーマンスレポート生成
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      results: this.results.sort((a, b) => a.duration - b.duration)
    };

    console.table(this.results.map(r => ({
      Test: r.label,
      Duration: r.duration ? `${r.duration}ms` : 'N/A',
      Performance: r.duration ? this.getPerformanceRating(r.duration) : 'N/A'
    })));

    // 性能改善の提案
    this.generateOptimizationSuggestions();
    
    return report;
  }

  /**
   * パフォーマンス評価
   * @param {number} duration - 実行時間（ミリ秒）
   * @returns {string} 評価
   */
  getPerformanceRating(duration) {
    if (duration < 10) return '🚀 Excellent';
    if (duration < 50) return '✅ Good';
    if (duration < 100) return '⚠️ Fair';
    return '🐌 Needs Improvement';
  }

  /**
   * 最適化提案生成
   */
  generateOptimizationSuggestions() {
    console.group('💡 Optimization Suggestions');
    
    const slowTests = this.results.filter(r => r.duration > 50);
    
    if (slowTests.length === 0) {
      console.log('✨ All operations are performing optimally!');
    } else {
      console.log('🔧 Consider optimizing these operations:');
      slowTests.forEach(test => {
        console.log(`   • ${test.label}: ${test.duration}ms`);
      });
    }
    
    console.log('📝 General recommendations:');
    console.log('   • Use DocumentFragment for bulk DOM operations');
    console.log('   • Implement proper cleanup to prevent memory leaks');
    console.log('   • Cache frequently accessed DOM elements');
    console.log('   • Use debouncing for rapid-fire events');
    console.log('   • Minimize Chrome API calls');
    
    console.groupEnd();
  }

  /**
   * 結果をJSONでエクスポート
   */
  exportResults() {
    const exportData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        averageDuration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / this.results.length,
        fastestTest: this.results.reduce((min, r) => !min || (r.duration && r.duration < min.duration) ? r : min, null),
        slowestTest: this.results.reduce((max, r) => !max || (r.duration && r.duration > max.duration) ? r : max, null)
      }
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// 使用例
if (typeof window !== 'undefined') {
  window.PerformanceBenchmark = PerformanceBenchmark;
  
  // 自動実行（開発環境のみ）
  if (process?.env?.NODE_ENV === 'development') {
    const benchmark = new PerformanceBenchmark();
    benchmark.runComprehensiveTest().then(() => {
      console.log('🎯 Performance benchmark completed');
    });
  }
}