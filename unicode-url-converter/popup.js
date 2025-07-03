document.addEventListener('DOMContentLoaded', function() {
  const convertBtn = document.getElementById('convertBtn');
  const statusDiv = document.getElementById('status');

  convertBtn.addEventListener('click', async function() {
    try {
      // 現在のアクティブなタブを取得
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // ファイルURLの場合は特別な処理が必要
      if (tab.url.startsWith('file://')) {
        showStatus(false, 'ファイルURLでは動作しません。HTTPSサイトでお試しください。');
        return;
      }
      
      // コンテンツスクリプトが読み込まれているかチェック
      try {
        // まずpingメッセージを送信してコンテンツスクリプトの存在を確認
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (pingError) {
        // コンテンツスクリプトが読み込まれていない場合は手動で注入
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          // 少し待ってからメッセージを送信
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (injectError) {
          showStatus(false, 'コンテンツスクリプトの注入に失敗しました。ページを再読み込みしてください。');
          return;
        }
      }
      
      // コンテンツスクリプトに変換実行のメッセージを送信
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'convertText' });
      
      // 結果を表示
      showStatus(response.success, response.message, response.count);
      
    } catch (error) {
      console.error('Error:', error);
      if (error.message.includes('Could not establish connection')) {
        showStatus(false, 'ページとの接続に失敗しました。ページを再読み込みしてください。');
      } else {
        showStatus(false, 'エラーが発生しました: ' + error.message);
      }
    }
  });

  function showStatus(success, message, count = 0) {
    statusDiv.style.display = 'block';
    statusDiv.className = 'status ' + (success ? 'success' : 'error');
    
    if (success && count > 0) {
      statusDiv.textContent = `変換完了: ${count}個の文字を変換しました`;
    } else if (success && count === 0) {
      statusDiv.textContent = '変換対象の文字が見つかりませんでした';
    } else {
      statusDiv.textContent = message;
    }
    
    // 3秒後にステータスを非表示にする
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});

