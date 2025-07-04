/**
 * バックグラウンドサービスワーカー
 * Chrome拡張機能のバックグラウンド処理とイベント管理
 */

// Chrome拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Unicode URL Converter installed');
    
    // デフォルト設定の初期化
    chrome.storage.local.set({
      conversionMap: {
        '\u02F8': ':',
        '\u2024': '.',
        '\u2044': '/'
      },
      targetTags: 'p',
      conversionHistory: []
    });
  } else if (details.reason === 'update') {
    console.log('Unicode URL Converter updated to version', chrome.runtime.getManifest().version);
    
    // バージョン2.0.0の新機能通知（オプション）
    if (details.previousVersion && details.previousVersion.startsWith('1.')) {
      // 設定の移行やアップデート処理をここに追加
      console.log('Migrating from version 1.x to 2.0.0');
    }
  }
});

// 拡張機能の起動時処理
chrome.runtime.onStartup.addListener(() => {
  console.log('Unicode URL Converter started');
});

// アクションボタンクリック時の処理（オプション）
chrome.action.onClicked.addListener((tab) => {
  // ポップアップが定義されているため、通常はこのイベントは発生しない
  // 将来的にポップアップなしでの動作が必要な場合に使用
  console.log('Extension action clicked on tab:', tab.id);
});

// メッセージリスナー（コンテンツスクリプトからの通信用）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 現在はポップアップ⇔コンテンツスクリプト間の直接通信を使用
  // 将来的にバックグラウンド経由の通信が必要な場合はここで処理
  
  if (request.action === 'getExtensionInfo') {
    sendResponse({
      version: chrome.runtime.getManifest().version,
      name: chrome.runtime.getManifest().name
    });
    return true;
  }
  
  // その他のメッセージタイプの処理
  return false;
});

// タブ更新時の処理（オプション）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 特定の条件下での自動処理が必要な場合はここに実装
  // 現在は手動実行のみサポート
});

// エラーハンドリング
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service worker unhandled promise rejection:', event.reason);
});

console.log('Unicode URL Converter background script loaded');