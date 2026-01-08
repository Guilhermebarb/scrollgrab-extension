// popup.js
document.getElementById('btnCapturar').addEventListener('click', async () => {
  // Pega a aba ativa atual
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Envia uma mensagem para o content.js naquela aba para iniciar o processo
  chrome.tabs.sendMessage(tab.id, { action: "start_full_page_capture" });
  
  // Fecha o popup
  window.close();
});