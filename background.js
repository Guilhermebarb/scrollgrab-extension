// background.js
// Escuta mensagens vindas do content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "take_screenshot_chunk") {
    // Tira foto da área visível da aba atual
    chrome.tabs.captureVisibleTab(null, {format: "png"}, (dataUrl) => {
      // Envia a imagem (em formato de texto base64) de volta para o content.js
      sendResponse({imgData: dataUrl});
    });
    return true; // Mantém o canal de mensagem aberto para a resposta assíncrona
  }
});