import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import type { GeminiPart, InlineDataPart } from '../types';

// Check for the API key at initialization.
if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Using a placeholder. App functionality will be limited.");
}

// Initialize the Google AI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

/**
 * The core system prompt that defines the MARI persona for the AI.
 * This detailed instruction set guides the AI's behavior, tone, and output structure.
 */
const MARY_PERSONA_PROMPT = `
1.0 DIRETRIZ PRIMÁRIA E PERSONA
--------------------------------
1.1 Persona
Você é Mary, uma IA Analista de Estratégia de Mídia da Artplan.
Sua função é receber dados brutos e briefings para gerar rascunhos de relatórios de alto impacto, com visualização clara e insights acionáveis, formatados em Markdown.
Você deve atuar como cientista de dados, interpretando planilhas e relatórios oficiais, cruzando dados, gerando análises profundas e visuais.

1.2 Diretriz Primária
Sua missão é produzir rascunhos que sirvam como ferramentas de negócio decisivas. Cada documento deve ser:
- **Estrategicamente denso e conciso:** Foque em um formato "OnePage". Rico em dados, análises e insights, mas sem excessos.
- **Comunicativamente assertivo:** claro, convincente e baseado em fatos.

1.3 Tom de Voz: "Strategic & Assertive"
- O impacto nasce da clareza e autoridade dos dados, nunca de adjetivos vazios.
- Escreva como um consultor sênior. Frases curtas, diretas e factuais.
- Conclua sempre com insights aplicáveis.
- Evite palavras fortes como *disruptivo, recorde, mudança de paradigma* sem comprovação robusta.

2.0 PROTOCOLO OPERACIONAL
--------------------------------
2.1 Fase de Análise e Síntese
- Analise todas as fontes fornecidas nos arquivos anexados, incluindo o conteúdo de imagens (prints de dashboards, recortes, etc.).
- Extraia métricas quantitativas e insights qualitativos.
- **REGRA DE OURO INLINE:** Ao mencionar qualquer métrica ou dado extraído de um arquivo, **CITE A FONTE IMEDIATAMENTE APÓS O DADO**, no formato (Fonte: nome_do_arquivo.xlsx). Isso é crucial.
- Privilegie sempre os dados das planilhas e PDFs fornecidos. Fontes da web (via Google Search, se ativado) devem ser usadas para complementar e contextualizar, nunca para substituir os dados primários. As fontes da web devem ser listadas apenas no final do relatório.

3.0 ESPECIFICAÇÃO DE CONTEÚDO E ESTRUTURA
-----------------------------------------
3.1 Blueprint Narrativo
O rascunho em Markdown deve seguir esta estrutura:
- **Resumo Estratégico:** 3 principais takeaways.
- **Contextualização:** O cenário analisado.
- **Análise Comparativa/Evolutiva:** Comparações de dados e tendências.
- **Análise de Audiência:** Dados de comportamento/demografia.
- **Impacto e Resultados:** Métricas de performance relevantes.
- **Implicações e Oportunidades:** O "e daí?" - o que os dados significam e quais os próximos passos.

3.2 Visualização de Dados (IMPORTANTE)
- **NÃO USE TABELAS MARKDOWN TRADICIONAIS** (\`| Header | ... |\`). Elas não são renderizadas corretamente.
- Para apresentar KPIs e métricas chave, use **SEMPRE** um dos seguintes formatos visuais:
  - **Cards/Blocos (Big Numbers):** Use blockquotes para destacar métricas individuais.
    Exemplo:
    > **Receita do Trimestre**
    > US$ 2.7 bilhões
    > ↑ 8% vs período anterior
  - **Listas com Emojis:** Use listas para agrupar métricas relacionadas, com emojis relevantes.
    Exemplo:
    - 📊 **Receita**: US$ 2.7B (+8% vs Q3)
    - 💰 **EBITDA**: US$ 200M (+11% vs Q3)
`;

/**
 * A dictionary of expert-level prompts tailored to specific report themes.
 * This allows the AI to focus its analysis based on the user's strategic goal.
 */
const THEME_PROMPTS: Record<string, string> = {
    'Estratégia de Crescimento': `
**Foco do Relatório: Estratégia de Crescimento**
O objetivo é identificar as principais alavancas de crescimento. Analise os dados para encontrar:
- Canais com melhor performance (ROI, CPA, etc.) e potencial de otimização.
- Segmentos de audiência com maior engajamento ou conversão.
- Oportunidades de mercado não exploradas com base nos dados e contexto da web.
- Análise competitiva, se houver dados para tal.
Estruture a seção "Implicações e Oportunidades" com recomendações claras para impulsionar o crescimento.`,
    'Reconhecimento de Marca': `
**Foco do Relatório: Reconhecimento de Marca (Brand Awareness)**
O objetivo é mensurar e entender a visibilidade e percepção da marca. Analise os dados para encontrar:
- Evolução do Share of Voice, alcance e impressões.
- Análise de sentimento e menções à marca (se houver dados de social listening).
- Performance de campanhas de topo de funil (views, cliques, etc.).
- Insights sobre a percepção da marca pela audiência.
Destaque no "Resumo Estratégico" os principais KPIs que demonstram a saúde da marca no período.`,
    'Análise de Mercado': `
**Foco do Relatório: Análise de Mercado**
O objetivo é fornecer um panorama do mercado e da posição do cliente. Analise os dados para:
- Mapear os principais concorrentes e suas performances.
- Identificar tendências de consumo e comportamento do consumidor (dados TGI, se disponíveis).
- Avaliar o market share e oportunidades de posicionamento.
- Usar a busca na web (se ativada) para contextualizar os dados com notícias e movimentos recentes do setor.
A conclusão deve apresentar um diagnóstico claro da posição competitiva do cliente.`,
    'Planejamento de Mídia': `
**Foco do Relatório: Planejamento de Mídia**
O objetivo é analisar dados para informar um futuro plano de mídia. Procure por:
- Performance histórica de diferentes canais e formatos.
- Insights de audiência (TGI, etc.) para guiar a seleção de canais.
- Análise de sazonalidade e picos de interesse (Google Trends, se aplicável).
- Recomendações de mix de canais e orçamento com base nos dados.
A seção "Implicações e Oportunidades" deve ser um pré-planejamento tático.`,
    'Análise de Social Media': `
**Foco do Relatório: Análise de Social Media**
O objetivo é avaliar a performance e o impacto das redes sociais. Analise:
- Métricas de engajamento (curtidas, comentários, compartilhamentos) por plataforma.
- Crescimento da base de seguidores.
- Análise de conteúdo: quais formatos e temas performam melhor?
- Análise de sentimento e principais temas de conversa.
- Performance de campanhas de social ads (se houver dados).`,
    'Relatório de Performance (Pós-Campanha)': `
**Foco do Relatório: Performance de Campanha**
O objetivo é fazer uma análise detalhada dos resultados de uma campanha finalizada. Foque em:
- Comparar os resultados com os KPIs e metas estabelecidas no briefing.
- Analisar o funil de conversão (impressões, cliques, leads, vendas).
- Calcular métricas chave como CPA, CPL, ROAS (se dados disponíveis).
- Identificar os principais aprendizados e otimizações realizadas.
O "Resumo Estratégico" deve responder claramente: "A campanha atingiu seus objetivos?"`,
    'Branding & Posicionamento': `
**Foco do Relatório: Branding & Posicionamento**
O objetivo é analisar como a marca está sendo percebida. Analise:
- Dados de Brand Lift, Health Tracking, e pesquisas de marca.
- Menções na mídia e análise de sentimento.
- Territórios de comunicação associados à marca.
- Comparativos com concorrentes em termos de percepção.
O relatório deve concluir com um diagnóstico sobre a força e o posicionamento atual da marca.`,
    'Análise de Concorrência': `
**Foco do Relatório: Análise de Concorrência**
O objetivo é monitorar e analisar as ações dos concorrentes. Busque por:
- Exemplos de campanhas e peças criativas dos concorrentes.
- Estimativas de investimento de mídia (se houver dados).
- Share of Voice e Share of Mind.
- Análise de posicionamento e territórios de comunicação dos concorrentes.
A seção "Implicações e Oportunidades" deve focar em como o cliente pode se diferenciar ou reagir.`,
};

/**
 * Generates the main report draft by combining the persona, user prompt, and file data.
 * @param {string} theme - The selected report theme, used to pick a specific prompt.
 * @param {string} prompt - The user's custom briefing and details.
 * @param {GeminiPart[]} fileParts - An array of processed file parts (text or inlineData).
 * @param {boolean} useGoogleSearch - Flag to enable or disable the Google Search tool.
 * @param {string} tone - The desired tone for the report, which modifies the persona prompt.
 * @returns {Promise<{ text: string, groundingChunks?: any[] }>} The generated text and any web sources used.
 */
export async function generateReportDraft(
    theme: string,
    prompt: string,
    fileParts: GeminiPart[],
    useGoogleSearch: boolean,
    tone: string,
): Promise<{ text: string, groundingChunks?: any[] }> {
    try {
        const themePrompt = THEME_PROMPTS[theme] || 'Analise os dados fornecidos e gere um relatório conciso e estratégico.';
        
        // Dynamically add tone instruction to the main persona prompt
        const toneInstruction = `\n1.4 Tom Específico para este Relatório: Adote um tom **${tone}**.`;
        const finalSystemPrompt = MARY_PERSONA_PROMPT + toneInstruction;

        const fullUserPrompt = `${themePrompt}\n\n**Briefing do Usuário:**\n${prompt}`;

        const baseConfig: any = {
            systemInstruction: finalSystemPrompt,
        };

        if (useGoogleSearch) {
            baseConfig.tools = [{ googleSearch: {} }];
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: {
                parts: [
                    { text: fullUserPrompt },
                    ...fileParts
                ]
            },
            config: {
                ...baseConfig,
                thinkingConfig: { thinkingBudget: 32768 },
            },
        });
        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return { text, groundingChunks };

    } catch (error) {
        console.error("Error generating report draft:", error);
        throw new Error("Failed to generate report draft. Please check the console for details.");
    }
}

/**
 * Generates an image from a text prompt.
 * @param {string} prompt - The text prompt describing the desired image.
 * @returns {Promise<string>} A base64 data URL of the generated image.
 */
export async function generateImageFromText(prompt: string): Promise<string> {
    try {
        const finalPrompt = `${prompt}. IMPORTANTE: Não gere nenhum tipo de texto, letra ou número na imagem. O resultado deve ser puramente visual.`
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: finalPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates?.[0]?.content.parts || []) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                return imageUrl;
            }
        }
        throw new Error("Nenhuma imagem foi gerada na resposta.");

    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Falha ao gerar imagem. Por favor, verifique o console para mais detalhes.");
    }
}

/**
 * Generates a creative prompt suggestion for an image based on the report content.
 * @param {string} reportContent - The full text of the generated report.
 * @returns {Promise<string>} A promise that resolves with a short, conceptual image prompt.
 */
export async function generateImagePromptSuggestion(reportContent: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `Baseado no seguinte relatório, crie um prompt curto (máximo 15 palavras) para gerar uma imagem de capa. O prompt deve ser conceitual, simbólico e profissional. Exemplo: "Uma ponte de dados conectando estratégia e resultados, em estilo abstrato."\n\nRELATÓRIO:\n${reportContent}`
                }]
            },
            config: {
                temperature: 0.8,
                maxOutputTokens: 50,
            }
        });
        return response.text.trim().replace(/"/g, ''); // Clean up quotes
    } catch (error) {
        console.error("Error generating image prompt suggestion:", error);
        return ''; // Return empty string on failure
    }
}

/**
 * Generates a suggestion for the visual style of presentation images based on the report content.
 * @param {string} reportContent - The full text of the generated report.
 * @returns {Promise<string>} A promise that resolves with a short string describing a visual style.
 */
export async function generateImageStyleSuggestion(reportContent: string): Promise<string> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [{
                    text: `Baseado no tom e conteúdo do seguinte relatório, sugira um estilo visual para as imagens de uma apresentação (máximo 5 palavras). Exemplos: "Fotorrealista, corporativo, tons de azul", "Ilustração vetorial, minimalista", "Arte linear, limpa e moderna".\n\nRELATÓRIO:\n${reportContent}`
                }]
            },
            config: {
                temperature: 0.7,
                maxOutputTokens: 30,
            }
        });
        return response.text.trim().replace(/"/g, ''); // Clean up quotes
    } catch (error) {
        console.error("Error generating image style suggestion:", error);
        return ''; // Return empty string on failure
    }
}