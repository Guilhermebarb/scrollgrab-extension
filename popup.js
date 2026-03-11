document.getElementById('btnCapturar').addEventListener('click', async () => {
  const area = document.getElementById('tipoArea').value;
  const acao = document.getElementById('tipoAcao').value;

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Envia a ordem com o que o usuário escolheu
  chrome.tabs.sendMessage(tab.id, { 
      action: "iniciar_captura", 
      tipoArea: area,
      tipoAcao: acao
  });
  
  window.close(); // Fecha o menu
});