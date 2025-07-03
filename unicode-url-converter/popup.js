import { getConversionMap, getTargetTags, setTargetTags, setConversionMap, removeSettings, saveHistoryEntry } from './storage.js';
import { localizeHtml, showStatus, renderConversionList, renderHistory, initSortableList, handleAddFormSubmit, handleConversionListClick, handleClearHistoryClick } from './ui.js';

document.addEventListener('DOMContentLoaded', function() {
  localizeHtml();

  const convertBtn = document.getElementById('convertBtn');
  const addForm = document.getElementById('addForm');
  const conversionList = document.getElementById('conversionList');
  const importInput = document.getElementById('importInput');
  const exportBtn = document.getElementById('exportBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Content scriptとの通信を確立する関数
  async function ensureContentScript(tabId) {
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Content script connection attempt ${attempt}/${maxRetries}`);
        
        // まずpingで接続確認
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('Content script is ready');
        return true;
        
      } catch (error) {
        lastError = error;
        console.log(`Ping failed on attempt ${attempt}:`, error.message);
        
        if (attempt < maxRetries) {
          try {
            // Content scriptを注入
            console.log('Injecting content script...');
            await chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content.js']
            });
            
            // 注入後の待機時間を段階的に増加
            const waitTime = attempt * 200;
            console.log(`Waiting ${waitTime}ms for content script to initialize...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
          } catch (injectError) {
            console.error('Failed to inject content script:', injectError);
            lastError = injectError;
          }
        }
      }
    }
    
    throw lastError;
  }

  convertBtn.addEventListener('click', async function() {
    try {
      console.log('Convert button clicked');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Active tab:', tab.url);
      
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
      console.log('Target tags:', tags);
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'convertText', tags: tags });
      console.log('Conversion response:', response);
      
      showStatus(response.success, response.message, response.count);
      
      if (response.success && response.count > 0) {
        const historyEntry = {
          url: tab.url,
          count: response.count,
          date: new Date().toISOString()
        };
        console.log('Saving history entry:', historyEntry);
        await saveHistoryEntry(historyEntry);
        console.log('History saved, rendering...');
        renderHistory();
      } else {
        console.log('Not saving history - success:', response.success, 'count:', response.count);
      }
      
    } catch (error) {
      console.error('Conversion error:', error);
      
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

  clearHistoryBtn.addEventListener('click', handleClearHistoryClick);

  renderConversionList();
  renderHistory();
  initSortableList(conversionList);
  addForm.addEventListener('submit', handleAddFormSubmit);
  conversionList.addEventListener('click', handleConversionListClick);
});

