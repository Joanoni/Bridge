/**
 * Pipeline de Exemplo: Status
 * Este script demonstra como renderizar uma UI e ouvir eventos vindos dela.
 */

export async function run() {
    console.log("Iniciando Pipeline de Status...");

    // 1. Definir os dados iniciais (Hidratação)
    const initialData = {
        title: "Monitor de Sistema Bridge",
        description: "O pipeline está ativo e aguardando interações do usuário."
    };

    // 2. Renderizar o componente 'status.html' localizado em .bridge/ui/
    bridge.ui.render('status', initialData);

    // 3. Configurar um listener para mensagens vindas da Webview
    // O status.html envia 'BUTTON_CLICKED' quando o botão é pressionado
    const unsubscribe = bridge.ui.onMessage((message) => {
        console.log("Evento recebido da UI:", message);

        if (message.action === 'BUTTON_CLICKED') {
            // Atualizar a UI com novos dados sem recarregar a página
            bridge.ui.postMessage({
                type: 'HYDRATE',
                payload: {
                    title: "Botão Clicado!",
                    description: `Último clique registrado em: ${new Date(message.timestamp).toLocaleTimeString()}`
                }
            });
        }
    });

    // Manter o pipeline vivo para continuar ouvindo eventos
    // Em uma versão real, você poderia usar timers ou aguardar processos externos
    return new Promise((resolve) => {
        // O pipeline será encerrado se o processo for morto pelo Host (VS Code)
    });
}