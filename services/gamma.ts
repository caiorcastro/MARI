/**
 * A service for interacting with the Gamma API to generate PPTX presentations.
 * This service uses the modern Public API `/generations` endpoint.
 */

const GAMMA_PUBLIC_API_BASE_URL = 'https://public-api.gamma.app/v1.0';
const apiKey = "sk-gamma-AKebBwbd65YzLK8dCoJjv0T6G7Xvmyj7xmWBh5VezX0";

// To fix the "Failed to fetch" CORS error, client-side requests must be routed through a CORS proxy.
const CORS_PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

/**
 * Represents the response from the initial POST to the /generations endpoint.
 */
interface GammaGenerationStartResponse {
    generationId: string;
    status: string;
}

/**
 * Represents the response when polling for the generation status.
 */
interface GammaGenerationStatusResponse {
    generationId: string;
    status: 'pending' | 'completed' | 'failed';
    gammaUrl?: string;
    pptxUrl?: string; // Available when status is 'completed'
    error?: string;
}

/**
 * Lists all available themes from the Gamma Public API.
 * It handles pagination to ensure all themes are fetched.
 * @returns {Promise<{ id: string, name: string }[]>} A promise that resolves with an array of theme objects.
 */
export async function listGammaThemes(): Promise<{ id: string, name: string }[]> {
    if (!apiKey) {
        throw new Error("A chave da API da Gamma (GAMMA_API_KEY) não está configurada.");
    }

    let allThemes: { id: string, name: string }[] = [];
    let hasMore = true;
    let afterCursor: string | null = null;
    const limit = 50;

    while (hasMore) {
        const targetUrl = new URL(`${GAMMA_PUBLIC_API_BASE_URL}/themes`);
        targetUrl.searchParams.append('limit', String(limit));
        if (afterCursor) {
            targetUrl.searchParams.append('after', afterCursor);
        }

        const response = await fetch(`${CORS_PROXY_URL}${targetUrl.toString()}`, {
            method: 'GET',
            headers: { 'X-API-KEY': apiKey }
        });

        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 403 && errorText.toLowerCase().includes('corsdemo')) {
                 throw new Error('CORS_PROXY_REQUIRED:Acesso ao proxy necessário. Por favor, ative-o e tente novamente.');
            }
            throw new Error(`Erro ao listar temas da Gamma: ${response.status} ${errorText}`);
        }

        const page = await response.json();
        const themesFromPage = page.data
            .map((theme: any) => ({ id: theme.id, name: theme.name }));
            
        allThemes = [...allThemes, ...themesFromPage];

        hasMore = page.hasMore;
        afterCursor = page.nextCursor;
    }

    return allThemes;
}

/**
 * Polls the Gamma Public API to check the status of a presentation generation task.
 * @param {string} generationId - The ID of the generation task to poll.
 * @returns {Promise<string>} A promise that resolves with the PPTX download URL.
 * @throws {Error} Throws an error if the task fails or times out.
 */
async function pollForPptxGeneration(generationId: string): Promise<string> {
    const pollInterval = 5000; // Poll every 5 seconds
    const maxAttempts = 30;   // Timeout after 2.5 minutes (30 * 5s)
    let attempts = 0;

    console.log(`[Gamma Service] Iniciando polling para generationId: ${generationId}`);

    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                clearInterval(intervalId);
                console.error(`[Gamma Service] Timeout para generationId: ${generationId}`);
                return reject(new Error('A geração do PPTX demorou muito. Tente novamente mais tarde.'));
            }

            try {
                const targetUrl = `${GAMMA_PUBLIC_API_BASE_URL}/generations/${generationId}`;
                const response = await fetch(`${CORS_PROXY_URL}${targetUrl}`, {
                    method: 'GET',
                    headers: { 'X-API-KEY': apiKey }
                });

                if (!response.ok) {
                    clearInterval(intervalId);
                    const errorText = await response.text();
                     if (response.status === 403 && errorText.toLowerCase().includes('corsdemo')) {
                        return reject(new Error('CORS_PROXY_REQUIRED:Acesso ao proxy necessário. Por favor, ative-o e tente novamente.'));
                     }
                    console.error(`[Gamma Service] Erro no polling: ${errorText}`);
                    return reject(new Error(`Erro ao verificar o status do PPTX: ${errorText}`));
                }

                const result: GammaGenerationStatusResponse = await response.json();
                console.log(`[Gamma Service] Status no polling #${attempts}: ${result.status}`);

                if (result.status === 'completed' && result.pptxUrl) {
                    clearInterval(intervalId);
                    console.log(`[Gamma Service] Geração concluída! URL: ${result.pptxUrl}`);
                    resolve(result.pptxUrl);
                } else if (result.status === 'failed') {
                    clearInterval(intervalId);
                    console.error(`[Gamma Service] Falha na geração: ${result.error}`);
                    reject(new Error(`A API da Gamma falhou ao gerar o PPTX: ${result.error || 'Erro desconhecido'}`));
                }
                // If 'pending', the loop continues.

            } catch (error) {
                clearInterval(intervalId);
                console.error(`[Gamma Service] Erro de rede no polling:`, error);
                reject(error);
            }

        }, pollInterval);
    });
}


/**
 * Generates a PowerPoint presentation from a markdown string using the Gamma Public API.
 * @param {string} markdownContent - The markdown content for the presentation.
 * @param {string} themeId - The ID of the Gamma theme to apply.
 * @param {string} [imageStyle] - Optional description of the desired image style.
 * @returns {Promise<string>} A promise that resolves to the downloadable URL of the .pptx file.
 */
export async function generatePresentation(markdownContent: string, themeId: string, imageStyle?: string): Promise<string> {
    if (!apiKey) {
        throw new Error("A chave da API da Gamma (GAMMA_API_KEY) não está configurada.");
    }
    
    try {
        const generationBody: any = {
            inputText: markdownContent,
            textMode: 'preserve', // Use preserve to respect the markdown structure
            format: 'presentation',
            themeId: themeId,
            exportAs: 'pptx',
            cardOptions: {
                dimensions: '16x9' // Standard PPT aspect ratio
            },
        };
        
        if (imageStyle) {
            generationBody.imageOptions = {
                source: 'aiGenerated',
                style: imageStyle
            };
        }

        console.log('[Gamma Service] Enviando requisição para /generations com body:', generationBody);

        // Step 1: Start the generation process
        const initialResponse = await fetch(`${CORS_PROXY_URL}${GAMMA_PUBLIC_API_BASE_URL}/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: JSON.stringify(generationBody),
        });

        if (!initialResponse.ok) {
            const errorText = await initialResponse.text();
            if (initialResponse.status === 403 && errorText.toLowerCase().includes('corsdemo')) {
                throw new Error('CORS_PROXY_REQUIRED:Acesso ao proxy necessário. Por favor, ative-o e tente novamente.');
            }
            console.error("[Gamma Service] Erro da API ao iniciar geração:", errorText);
            throw new Error(`Erro da API da Gamma ao iniciar a geração: ${errorText}`);
        }
        
        const responseData: GammaGenerationStartResponse = await initialResponse.json();
        console.log('[Gamma Service] Geração iniciada com sucesso:', responseData);

        // Step 2: Poll the task status until the PPTX is ready.
        const pptxDownloadUrl = await pollForPptxGeneration(responseData.generationId);

        return pptxDownloadUrl;

    } catch (error) {
        console.error("[Gamma Service] Erro ao gerar apresentação:", error);
        // Re-throw the error to be caught by the calling component.
        throw error;
    }
}