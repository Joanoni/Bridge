/**
 * Pipeline: Demo Processamento de Texto
 * Função: Orquestra a chamada ao worker e exibe o resultado.
 */

export const config = {
    id: 'demo-text-processing',
    description: 'Envia um texto para o worker processar e exibe o resultado.'
};

export async function run() {
    console.log('[Pipeline] Iniciando fluxo de processamento...');

    // 1. Definir o dado de entrada (Num futuro, poderia vir de um input do usuário)
    const inputData = "O Bridge conecta ideias";

    bridge.ui.render('status-loader', { message: 'Processando texto...' });

    try {
        // 2. Chamar o Script Atômico (O Worker)
        // O segundo argumento é o payload que vira 'bridge.input' no worker
        const result = await bridge.execute('text-processor.js', { 
            text: inputData 
        });

        console.log('[Pipeline] Resultado recebido do worker:', result);

        // 3. Renderizar o resultado final na UI
        bridge.ui.render('text-result', {
            title: "Processamento Concluído",
            data: result
        });

    } catch (error) {
        console.error('[Pipeline Error]', error);
        bridge.ui.render('status-loader', { message: `Erro: ${error.message}`, type: 'error' });
    }
}