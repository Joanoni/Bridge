/**
 * Configuração do Pipeline
 * O trigger 'onSave' é detetado pelo regex no extension.js
 */
export const config = { 
    id: 'save-monitor',
    trigger: 'onSave' 
};

/**
 * Função principal executada ao salvar qualquer ficheiro
 */
export async function run() {
    // Recuperar os dados do evento passados pelo Host via variável de ambiente
    // O bootstrapper deve injetar isso no bridge.input ou similar
    const eventData = process.env.BRIDGE_EVENT_PAYLOAD 
        ? JSON.parse(process.env.BRIDGE_EVENT_PAYLOAD) 
        : { fileName: 'Desconhecido', time: '--:--:--' };

    console.log(`[Pipeline] Ficheiro salvo: ${eventData.fileName} às ${eventData.time}`);

    // Renderizar a UI de notificação
    bridge.ui.render('save-notification', {
        title: "Ficheiro Salvo com Sucesso",
        file: eventData.fileName,
        timestamp: eventData.time
    });
}