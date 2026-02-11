/**
 * Script Atômico: Processador de Texto
 * Função: Recebe um texto, inverte e converte para maiúsculas.
 * Localização: .bridge/scripts/text-processor.js
 */

// 1. Acessar os dados passados pelo 'bridge.execute'
// O 'bridge.input' é o payload injetado no contexto da VM
const { text } = bridge.input;

if (!text || typeof text !== 'string') {
    throw new Error("[Text Processor] Payload inválido: propriedade 'text' é obrigatória.");
}

console.log(`[Worker] Recebi o texto: "${text}"`);

// 2. Executar a lógica de negócio (Pura)
const reversed = text.split('').reverse().join('');
const finalResult = reversed.toUpperCase();

// 3. Retornar o resultado para o Pipeline (Controller)
// O valor retornado aqui será o resultado da Promise no pipeline
return {
    original: text,
    processed: finalResult,
    length: text.length,
    processedAt: new Date().toISOString()
};