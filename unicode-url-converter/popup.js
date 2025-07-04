import { getConversionMap, getTargetTags, setTargetTags, setConversionMap, removeSettings, saveHistoryEntry } from './storage.js';
import { localizeHtml, showStatus, renderConversionList, renderHistory, initSortableList, handleAddFormSubmit, handleConversionListClick, handleClearHistoryClick } from './ui.js';

// メッセージアクションの定数
const MESSAGE_ACTION_PING = 'ping';
const MESSAGE_ACTION_CONVERT_TEXT = 'convertText';

// ストレージキーの定数
const STORAGE_KEY_CONVERSION_MAP = 'conversionMap';

document.addEventListener('DOMContentLoaded', function() {
  
  localizeHtml();

  // DOM要素の取得とnullチェック
  const convertBtn = document.getElementById('convertBtn');
  const addForm = document.getElementById('addForm');
  const conversionList = document.getElementById('conversionList');
  const importInput = document.getElementById('importInput');
  const exportBtn = document.getElementById('exportBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');



  /**
   * 指定されたタブでコンテンツスクリプトが動作していることを確認し、必要であれば注入します。
   * pingメッセージを送信して確認し、失敗した場合はスクリプトを注入して再試行します。
   * @param {number} tabId - コンテンツスクリプトを確保するタブのID。
   * @returns {Promise<boolean>} コンテンツスクリプトが準備完了であればtrueを解決するPromise。
   * @throws {Error} 最大リトライ回数を超えてもコンテンツスクリプトを確保できなかった場合。
   */
  async function ensureContentScript(tabId) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // まずpingで接続確認
        await chrome.tabs.sendMessage(tabId, { action: MESSAGE_ACTION_PING });
        return true;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          try {
            // Content scriptを注入
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            });
            
            // 注入後の待機時間を段階的に増加
            const waitTime = attempt * 200;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
          } catch (injectError) {
            lastError = injectError;
          }
        }
      }
    }
    
    throw lastError;
  }

  // 要素が存在する場合のみイベントリスナーを追加
  if (convertBtn) {
    convertBtn.addEventListener('click', async function() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url.startsWith('file://')) {
          showStatus(false, chrome.i18n.getMessage('errorFileUrl'));
          return;
        }
        
        // Chrome拡張機能のページや特殊ページの場合は処理をスキップ
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
          showStatus(false, chrome.i18n.getMessage('errorChromePage'));
          return;
        }
        
        // Content scriptとの通信を確立
        await ensureContentScript(tab.id);
        
        const tags = await getTargetTags();
        
        const response = await chrome.tabs.sendMessage(tab.id, { action: MESSAGE_ACTION_CONVERT_TEXT, tags: tags });
        
        showStatus(response.success, response.message, response.count);
        
        if (response.success && response.count > 0) {
          const historyEntry = {
            url: tab.url,
            count: response.count,
            date: new Date().toISOString()
          };
          await saveHistoryEntry(historyEntry);
          renderHistory();
        }
        
      } catch (error) {
        
        // エラーメッセージに基づいて適切なメッセージを表示
        if (error.message.includes('Could not establish connection')) {
          showStatus(false, chrome.i18n.getMessage('errorConnection'));
        } else if (error.message.includes('Cannot access contents of url')) {
          showStatus(false, chrome.i18n.getMessage('errorCannotAccess'));
        } else if (error.message.includes('chrome-extension://')) {
          showStatus(false, chrome.i18n.getMessage('errorChromePage'));
        } else {
          showStatus(false, chrome.i18n.getMessage('errorGeneric', [error.message]));
        }
      }
    });
  }

  if (importInput) {
    importInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const map = JSON.parse(e.target.result);
          // Validate imported data
          if (typeof map !== 'object' || map === null) {
            showStatus(false, chrome.i18n.getMessage('statusImportError'));
            return;
          }
          for (const key in map) {
            if (!/^\\u[0-9A-Fa-f]{4}$/.test(key) || typeof map[key] !== 'string' || map[key].length !== 1) {
              showStatus(false, chrome.i18n.getMessage('statusImportError'));
              return;
            }
          }
          setConversionMap(map);
          renderConversionList();
          showStatus(true, chrome.i18n.getMessage('statusImportSuccess'));
        } catch (error) {
          showStatus(false, chrome.i18n.getMessage('statusImportError'));
        }
      };
      reader.readAsText(file);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', async function() {
      const map = await getConversionMap();
      const blob = new Blob([JSON.stringify(map, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'unicode-url-converter-map.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', handleClearHistoryClick);
  }

  // 初期化処理
  if (conversionList) {
    renderConversionList();
    initSortableList(conversionList);
  }
  
  renderHistory();
  
  if (addForm) {
    addForm.addEventListener('submit', handleAddFormSubmit);
  }
  
  if (conversionList) {
    conversionList.addEventListener('click', handleConversionListClick);
  }
});

// ポップアップ終了時のクリーンアップ
window.addEventListener('beforeunload', function() {
  // ui.js のstatusTimerをクリア
  if (typeof statusTimer !== 'undefined' && statusTimer) {
    clearTimeout(statusTimer);
  }
});

