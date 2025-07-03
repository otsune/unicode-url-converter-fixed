import { getConversionMap, getTargetTags, setTargetTags, removeSettings } from './storage.js';
import { localizeHtml, showStatus, renderConversionList, renderHistory, initSortableList, handleAddFormSubmit, handleConversionListClick, handleClearHistoryClick } from './ui.js';

document.addEventListener('DOMContentLoaded', function() {
  localizeHtml();

  const convertBtn = document.getElementById('convertBtn');
  const tagsInput = document.getElementById('tagsInput');
  const tagsForm = document.getElementById('tagsForm');
  const addForm = document.getElementById('addForm');
  const conversionList = document.getElementById('conversionList');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const exportBtn = document.getElementById('exportBtn');
  const resetBtn = document.getElementById('resetBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  convertBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url.startsWith('file://')) {
        showStatus(false, chrome.i18n.getMessage('errorFileUrl'));
        return;
      }
      
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (pingError) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (injectError) {
          showStatus(false, chrome.i18n.getMessage('errorInjectScript'));
          return;
        }
      }
      
      const tags = await getTargetTags();
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'convertText', tags: tags });
      
      showStatus(response.success, response.message, response.count);
      if (response.success && response.count > 0) {
        const historyEntry = {
          url: tab.url,
          count: response.count,
          date: new Date().toISOString()
        };
        // saveHistoryEntry(historyEntry); // ui.jsでrenderHistoryを呼ぶため、ここでは呼ばない
      }
      
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Could not establish connection')) {
        showStatus(false, chrome.i18n.getMessage('errorConnection'));
      } else {
        showStatus(false, chrome.i18n.getMessage('errorGeneric', [error.message]));
      }
    }
  });

  tagsForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const tags = tagsInput.value.trim();
    if (tags) {
      setTargetTags(tags);
      showStatus(true, chrome.i18n.getMessage('statusTagsSaved'));
    }
  });

  async function initTagsInput() {
    const tags = await getTargetTags();
    tagsInput.value = tags;
  }

  initTagsInput();

  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const map = JSON.parse(e.target.result);
        // TODO: インポートされたデータのバリデーション
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

  resetBtn.addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmReset'))) {
      removeSettings(['conversionMap', 'targetTags'], () => {
        renderConversionList();
        initTagsInput();
        showStatus(true, chrome.i18n.getMessage('statusResetSuccess'));
      });
    }
  });

  clearHistoryBtn.addEventListener('click', handleClearHistoryClick);

  renderConversionList();
  renderHistory();
  initSortableList(conversionList);
  addForm.addEventListener('submit', handleAddFormSubmit);
  conversionList.addEventListener('click', handleConversionListClick);
});

