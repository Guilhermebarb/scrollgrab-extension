// content.js

// Função auxiliar para esperar um tempo (necessário para a página renderizar após o scroll)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Função principal de captura
async function captureFullPage() {
    const body = document.body;
    const html = document.documentElement;

    // 1. Calcula a altura total real da página
    const fullHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    // Altura da janela visível
    const viewportHeight = window.innerHeight;
    // Largura da janela visível
    const viewportWidth = window.innerWidth;

    // 2. Cria um Canvas (tela de pintura) invisível para montar a imagem
    const canvas = document.createElement('canvas');
    canvas.width = viewportWidth;
    canvas.height = fullHeight;
    const ctx = canvas.getContext('2d');
    
    // Esconde a barra de rolagem para não sair no print
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let currentScrollY = 0;

    // 3. O Loop de Rolagem e Captura
    while (currentScrollY < fullHeight) {
        // Rola a página para a posição atual
        window.scrollTo(0, currentScrollY);
        
        // Espera 500ms para imagens carregarem e elementos fixos se ajustarem
        await sleep(500); 

        // Pede ao Background.js para tirar foto da área visível
        const response = await chrome.runtime.sendMessage({action: "take_screenshot_chunk"});
        
        if (response && response.imgData) {
            // Cria uma imagem com os dados recebidos
            const img = new Image();
            img.src = response.imgData;
            await new Promise(resolve => { img.onload = resolve; }); // Espera a imagem carregar na memória

            // Calcula onde desenhar essa fatia no canvas final.
            // Se for a última fatia, precisamos ajustar para não esticar.
            let heightToDraw = viewportHeight;
            if (currentScrollY + viewportHeight > fullHeight) {
                heightToDraw = fullHeight - currentScrollY;
            }
            
            // Desenha a fatia capturada no canvas principal na posição correta (currentScrollY)
            // Parâmetros: imagem, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH
            ctx.drawImage(img, 0, 0, viewportWidth, heightToDraw, 0, currentScrollY, viewportWidth, heightToDraw);
        }

        // Avança para a próxima fatia
        currentScrollY += viewportHeight;
    }

    // 4. Restaura a barra de rolagem
    document.documentElement.style.overflow = originalOverflow;
    window.scrollTo(0, 0); // Volta ao topo

    // 5. Salva a imagem final
    // Converte o canvas para um link de download e clica nele
    const link = document.createElement('a');
    link.download = 'captura-completa-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Escuta o comando do popup.js para começar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "start_full_page_capture") {
        captureFullPage();
    }
});