/**
 * 新しいアーキテクチャを使用したポップアップメインファイル
 * 依存関係注入とレイヤードアーキテクチャを適用
 */

// サービスとコントローラーのインポート
import { Services, getServiceContainer, logServiceContainerInfo } from './services/ServiceFactory.js';
import { ConversionController } from './controllers/ConversionController.js';
import { PopupController } from './controllers/PopupController.js';
import { localizeHtml, showStatus, renderConversionList, renderHistory, initSortableList, handleAddFormSubmit, handleConversionListClick, handleClearHistoryClick } from './ui.js';

// グローバル変数
let popupController = null;
let conversionController = null;

/**
 * アプリケーションを初期化
 */
async function initializeApplication() {
  try {
    // サービスコンテナの初期化
    const container = getServiceContainer();
    
    // 開発環境でのデバッグ情報出力
    if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
      logServiceContainerInfo();
    }

    // コントローラーの作成
    conversionController = new ConversionController(
      Services.message,
      Services.storage,
      Services.history
    );

    // UIレンダラーオブジェクト（既存のui.js関数をラップ）
    const uiRenderer = {
      showStatus,
      renderConversionList,
      renderHistory,
      initSortableList,
      cleanup: () => {
        // UI関連のクリーンアップ
        if (typeof statusTimer !== 'undefined' && statusTimer) {
          clearTimeout(statusTimer);
        }
      }
    };

    // ポップアップコントローラーの作成
    popupController = new PopupController(
      conversionController,
      Services.storage,
      Services.history,
      uiRenderer
    );

    // ポップアップコントローラーの初期化
    const initResult = await popupController.initialize();
    
    if (!initResult.success) {
      throw new Error(initResult.message);
    }

    // 国際化処理
    localizeHtml();

    console.log('✅ Application initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize application:', error);
    
    // フォールバック：エラーメッセージ表示
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.className = 'status error';
      statusDiv.textContent = `Initialization failed: ${error.message}`;
    }
  }
}

/**
 * 従来のイベントハンドラーとの互換性維持
 * 新しいアーキテクチャに段階的に移行するための橋渡し
 */
function setupLegacyCompatibility() {
  // 既存のui.js関数を新しいアーキテクチャで使用できるように調整
  window.handleAddFormSubmit = async function(event) {
    if (popupController) {
      await popupController.handleAddConversion(event);
    } else {
      // フォールバック
      await handleAddFormSubmit(event);
    }
  };

  window.handleConversionListClick = async function(event) {
    if (popupController) {
      await popupController.handleConversionListClick(event);
    } else {
      // フォールバック
      await handleConversionListClick(event);
    }
  };

  window.handleClearHistoryClick = async function() {
    if (popupController) {
      await popupController.handleClearHistory();
    } else {
      // フォールバック
      await handleClearHistoryClick();
    }
  };
}

/**
 * DOMContentLoaded イベントハンドラー
 */
document.addEventListener('DOMContentLoaded', async function() {
  // 従来との互換性を設定
  setupLegacyCompatibility();
  
  // 新しいアーキテクチャでアプリケーションを初期化
  await initializeApplication();
});

/**
 * ページアンロード時のクリーンアップ
 */
window.addEventListener('beforeunload', function() {
  if (popupController) {
    popupController.cleanup();
  }
});

/**
 * エラーハンドリング
 */
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error);
  
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status error';
    statusDiv.textContent = 'An unexpected error occurred. Please refresh the page.';
  }
});

/**
 * Promise rejection ハンドリング
 */
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status error';
    statusDiv.textContent = 'An unexpected error occurred. Please refresh the page.';
  }
});

// 開発用：グローバルアクセス（デバッグ目的）
if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
  window.debugApp = {
    get popupController() { return popupController; },
    get conversionController() { return conversionController; },
    get services() { return Services; },
    get container() { return getServiceContainer(); }
  };
}