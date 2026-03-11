const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let originalStyles = [];
let hiddenElements = [];

function hideFixedElements() {
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
            hiddenElements.push({ element: el, opacity: el.style.opacity, transition: el.style.transition });
            el.style.transition = 'none';
        }
    });
}

function expandScrollableElements() {
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
            originalStyles.push({ element: el, overflowY: el.style.overflowY, height: el.style.height, maxHeight: el.style.maxHeight });
            el.style.overflowY = 'visible'; el.style.height = 'max-content'; el.style.maxHeight = 'none';
        }
    });
    document.documentElement.style.height = 'max-content'; document.body.style.height = 'max-content';
}

function restoreElements() {
    originalStyles.forEach(item => { item.element.style.overflowY = item.overflowY; item.element.style.height = item.height; item.element.style.maxHeight = item.maxHeight; });
    originalStyles = [];
    hiddenElements.forEach(item => { item.element.style.opacity = item.opacity; item.element.style.transition = item.transition; });
    hiddenElements = [];
}

// --- SALVAR OU COPIAR A IMAGEM FINAL ---
function processFinalImage(canvas, tipoAcao) {
    if (tipoAcao === 'copy') {
        canvas.toBlob(blob => {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item]).then(() => {
                alert('✅ Imagem copiada! Pode dar Ctrl+V no WhatsApp, E-mail, etc.');
            }).catch(() => alert('Erro ao copiar. Tente baixar a imagem.'));
        });
    } else if (tipoAcao === 'download_pdf') {
        const { jsPDF } = window.jspdf;
        const orientacao = canvas.width > canvas.height ? 'l' : 'p';
        const doc = new jsPDF({ orientation: orientacao, unit: 'px', format: [canvas.width, canvas.height] });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        doc.save('captura-' + Date.now() + '.pdf');
    } else {
        const link = document.createElement('a');
        link.download = 'captura-' + Date.now() + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

// --- 1. CAPTURA FULL PAGE ---
async function captureFullPage(tipoAcao) {
    expandScrollableElements();
    hideFixedElements();
    await sleep(500);

    const body = document.body;
    const html = document.documentElement;
    const fullHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const canvas = document.createElement('canvas');
    canvas.width = viewportWidth; canvas.height = fullHeight;
    const ctx = canvas.getContext('2d');
    
    const originalOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    let currentScrollY = 0;
    while (currentScrollY < fullHeight) {
        window.scrollTo(0, currentScrollY);
        if (currentScrollY === 0) hiddenElements.forEach(item => item.element.style.opacity = item.opacity);
        else hiddenElements.forEach(item => item.element.style.opacity = '0');
        
        await sleep(500); 

        const response = await chrome.runtime.sendMessage({action: "take_screenshot_chunk"});
        if (response && response.imgData) {
            const img = new Image();
            img.src = response.imgData;
            await new Promise(resolve => { img.onload = resolve; }); 
            let heightToDraw = (currentScrollY + viewportHeight > fullHeight) ? fullHeight - currentScrollY : viewportHeight;
            ctx.drawImage(img, 0, 0, viewportWidth, heightToDraw, 0, currentScrollY, viewportWidth, heightToDraw);
        }
        currentScrollY += viewportHeight;
    }

    document.documentElement.style.overflow = originalOverflow;
    restoreElements(); 
    window.scrollTo(0, 0); 
    processFinalImage(canvas, tipoAcao);
}

// --- 2. CAPTURA APENAS VISÍVEL ---
async function captureVisible(tipoAcao) {
    const response = await chrome.runtime.sendMessage({action: "take_screenshot_chunk"});
    if (response && response.imgData) {
        const img = new Image();
        img.src = response.imgData;
        await new Promise(res => img.onload = res);

        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        processFinalImage(canvas, tipoAcao);
    }
}

// --- 3. SELECIONAR ÁREA (RECORTAR) ---
function initSelectionMode(tipoAcao) {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.3)'; overlay.style.zIndex = '9999999';
    overlay.style.cursor = 'crosshair';

    const selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute'; selectionBox.style.border = '2px dashed #fff';
    selectionBox.style.background = 'rgba(0, 123, 255, 0.2)';
    overlay.appendChild(selectionBox);
    document.body.appendChild(overlay);

    let startX, startY, isSelecting = false;

    overlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX; startY = e.clientY;
        selectionBox.style.left = startX + 'px'; selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px'; selectionBox.style.height = '0px';
    });

    overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        const currentX = e.clientX; const currentY = e.clientY;
        selectionBox.style.width = Math.abs(currentX - startX) + 'px';
        selectionBox.style.height = Math.abs(currentY - startY) + 'px';
        selectionBox.style.left = Math.min(startX, currentX) + 'px';
        selectionBox.style.top = Math.min(startY, currentY) + 'px';
    });

    overlay.addEventListener('mouseup', async () => {
        isSelecting = false;
        const rect = selectionBox.getBoundingClientRect();
        document.body.removeChild(overlay); 

        if (rect.width > 20 && rect.height > 20) {
            await sleep(100); // Espera a tela clarear
            captureArea(rect, tipoAcao);
        }
    });
}

async function captureArea(rect, tipoAcao) {
    const response = await chrome.runtime.sendMessage({action: "take_screenshot_chunk"});
    if (response && response.imgData) {
        const img = new Image();
        img.src = response.imgData;
        await new Promise(res => img.onload = res);

        const canvas = document.createElement('canvas');
        canvas.width = rect.width; canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        
        // Recorta exatamente onde o usuário desenhou o quadrado
        ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, rect.width, rect.height);
        processFinalImage(canvas, tipoAcao);
    }
}

// --- RECEBE A ORDEM DO MENU ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "iniciar_captura") {
        if (request.tipoArea === 'full') captureFullPage(request.tipoAcao);
        else if (request.tipoArea === 'visible') captureVisible(request.tipoAcao);
        else if (request.tipoArea === 'select') initSelectionMode(request.tipoAcao);
    }
});