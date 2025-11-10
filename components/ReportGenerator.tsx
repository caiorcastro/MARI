import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { generateReportDraft, generateImageFromText, generateImagePromptSuggestion, generateImageStyleSuggestion } from '../services/gemini';
import { generatePresentation, listGammaThemes } from '../services/gamma';
import { fileToBase64, downloadTextFile, convertExcelToText, fileToText } from '../utils/fileHelper';
import { UploadIcon, FileIcon, ImageIcon, TrashIcon, SparklesIcon, ClipboardIcon, DownloadIcon, GlobeIcon, SettingsIcon, FileTextIcon, WandIcon, EditIcon, SaveIcon, PresentationIcon, RefreshCwIcon } from './icons';
import type { GroundingChunk, ClientGroup, GeminiPart } from '../types';

// Declare the 'marked' library loaded from the CDN in index.html for markdown parsing.
declare var marked: any;

/**
 * A visual stepper component to guide the user through the report generation process.
 * @param {object} props - The component props.
 * @param {number} props.currentStep - The currently active step.
 * @returns {React.FC} The Stepper component.
 */
const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => {
    const steps = [
        { number: 1, title: 'Definição', icon: <SettingsIcon /> },
        { number: 2, title: 'Conteúdo', icon: <FileTextIcon /> },
        { number: 3, title: 'Geração', icon: <WandIcon /> },
    ];

    return (
        <nav className="flex items-center justify-center mb-12" aria-label="Progress">
            <ol className="flex items-center space-x-4 sm:space-x-8">
                {steps.map((step, index) => (
                    <li key={step.number}>
                        <div className={`flex items-center px-4 py-2 rounded-full transition-all duration-300 ${step.number === currentStep ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 text-gray-600'}`}>
                            {step.icon}
                            <span className="ml-2 mr-1 font-semibold">{step.title}</span>
                        </div>
                    </li>
                ))}
            </ol>
        </nav>
    );
};


/**
 * The core component for generating reports.
 * It manages a multi-step form, handles file uploads, interacts with the Gemini and Gamma APIs,
 * and displays the results.
 * @param {object} props - The component props.
 * @param {(context: string | null) => void} props.setReportContext - Callback to set the shared report context for the chat widget.
 * @returns {React.FC} The ReportGenerator component.
 */
export const ReportGenerator: React.FC<{ setReportContext: (context: string | null) => void }> = ({ setReportContext }) => {
    // --- STATE MANAGEMENT ---

    // UI State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Definition State
    const [clientGroups] = useState<ClientGroup[]>([
        { type: 'Cliente SP', clients: [
            { id: 'betmgm', name: 'BetMGM' },
            { id: 'braskem', name: 'Braskem' },
            { id: 'pagbank', name: 'PagBank' },
            { id: 'mrv', name: 'MRV' },
            { id: 'nio', name: 'NIO' },
        ]},
        { type: 'Cliente RJ', clients: [
            { id: 'globo', name: 'Globo / G1 / Gshow' },
            { id: 'petrobras', name: 'Petrobras / BR' },
            { id: 'oi', name: 'Oi' },
            { id: 'bobs', name: 'Bob’s' },
        ]},
        { type: 'Cliente DF', clients: [
            { id: 'govfed', name: 'Governo Federal / Sebrae / Banco do Brasil' },
        ]},
        { type: 'Unidade Dreamers', clients: [
            { id: 'dreamfactory', name: 'Dream Factory' },
            { id: 'convert', name: 'Convert+Performance' },
            { id: 'alab', name: 'A-LAB / NDAR / +Xou' },
        ]}
    ]);
    const [selectedClient, setSelectedClient] = useState<string>('betmgm');
    const [themes] = useState<string[]>(['Estratégia de Crescimento', 'Reconhecimento de Marca', 'Análise de Mercado', 'Planejamento de Mídia', 'Análise de Social Media', 'Relatório de Performance (Pós-Campanha)', 'Branding & Posicionamento', 'Análise de Concorrência']);
    const [selectedTheme, setSelectedTheme] = useState<string>('Estratégia de Crescimento');
    const [campaignName, setCampaignName] = useState('');
    const [tones] = useState<string[]>(['Analítico', 'Estratégico', 'Executivo', 'Técnico', 'Persuasivo', 'Criativo']);
    const [selectedTone, setSelectedTone] = useState('Analítico');
    
    // Step 2: Content State
    const [brief, setBrief] = useState('');
    const [knowledgeBaseFiles, setKnowledgeBaseFiles] = useState<File[]>([]);
    
    // Step 3: Generation State
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);

    // Results State
    const [draftResult, setDraftResult] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedDraft, setEditedDraft] = useState('');
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState('');
    const [imagePrompt, setImagePrompt] = useState('');
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    
    // PPTX State
    const [isPptLoading, setIsPptLoading] = useState(false);
    const [pptxUrl, setPptxUrl] = useState<string | null>(null);
    const [pptxError, setPptxError] = useState<string | null>(null);
    const [gammaThemes, setGammaThemes] = useState<{ id: string, name: string }[]>([]);
    const [selectedGammaTheme, setSelectedGammaTheme] = useState<string>('');
    const [loadingThemes, setLoadingThemes] = useState(false);
    const [imageStylePrompt, setImageStylePrompt] = useState('');
    const imageStylePresets = ['Fotorrealista', 'Ilustração', 'Arte Linear', 'Minimalista', 'Abstrato'];
    
    // Effect to update the shared context whenever the draft result changes.
    useEffect(() => {
        setReportContext(draftResult);
    }, [draftResult, setReportContext]);

    // Effect to fetch Gamma themes when a report is generated
    useEffect(() => {
        const fetchThemes = async () => {
            if (draftResult && gammaThemes.length === 0) {
                setLoadingThemes(true);
                setPptxError(null);
                try {
                    const themes = await listGammaThemes();
                    setGammaThemes(themes);
                } catch (err) {
                    console.error("Failed to fetch Gamma themes:", err);
                    if (err instanceof Error) {
                        setPptxError(err.message);
                    } else {
                        setPptxError("Não foi possível carregar os temas da apresentação.");
                    }
                } finally {
                    setLoadingThemes(false);
                }
            }
        };
        fetchThemes();
    }, [draftResult, gammaThemes.length]);

    // Memoized markdown parsing for performance.
    const parsedDraft = useMemo(() => {
        if (draftResult && typeof marked !== 'undefined') {
            return marked.parse(draftResult, { gfm: true, breaks: true });
        }
        return draftResult?.replace(/\n/g, '<br />') || ''; // Fallback for safety
    }, [draftResult]);


    // --- HANDLER FUNCTIONS ---

    /** Handles new file selections and adds them to the knowledge base. */
    const handleFileChange = (selectedFiles: FileList | null) => {
        if (selectedFiles) {
            setKnowledgeBaseFiles(prev => [...prev, ...Array.from(selectedFiles)]);
        }
    };
    
    /** Removes a specific file from the knowledge base by its index. */
    const removeFile = (index: number) => {
        setKnowledgeBaseFiles(prev => prev.filter((_, i) => i !== index));
    };

    /** Copies the generated report draft to the user's clipboard. */
    const handleCopyToClipboard = () => {
        if (draftResult) {
            navigator.clipboard.writeText(draftResult).then(() => {
                setCopySuccess('Copiado!');
                setTimeout(() => setCopySuccess(''), 2000);
            }, () => {
                setCopySuccess('Falha ao copiar.');
                setTimeout(() => setCopySuccess(''), 2000);
            });
        }
    };
    
    /** Downloads the generated report draft as a markdown (.md) file. */
    const handleDownload = () => {
        if (draftResult) {
            const clientName = clientGroups.flatMap(g => g.clients).find(c => c.id === selectedClient)?.name || 'report';
            const filename = `MARI_Rascunho_${clientName.replace(/\s/g, '_')}_${selectedTheme.replace(/\s/g, '_')}.md`;
            downloadTextFile(draftResult, filename);
        }
    }

    /** Resets the entire component state to its initial values to start a new report. */
    const resetGeneratorState = () => {
        setStep(1);
        setSelectedClient('betmgm');
        setSelectedTheme('Estratégia de Crescimento');
        setCampaignName('');
        setSelectedTone('Analítico');
        setUseGoogleSearch(false);
        setBrief('');
        setKnowledgeBaseFiles([]);
        setLoading(null);
        setError(null);
        setDraftResult(null);
        setSources([]);
        setGeneratedImage(null);
        setIsEditing(false);
        setEditedDraft('');
        setIsPptLoading(false);
        setPptxUrl(null);
        setPptxError(null);
        setGammaThemes([]);
        setSelectedGammaTheme('');
        setReportContext(null);
        setImagePrompt('');
        setImageStylePrompt('');
        setLoadingSuggestions(false);
    };

    /** Saves the edited draft, updating the main draft result. */
    const handleSaveEdit = () => {
        setDraftResult(editedDraft);
        setIsEditing(false);
    };

    /** Main handler to submit the form data and generate the initial report draft. */
    const handleSubmitDraft = useCallback(async () => {
        // Reset previous results
        setLoading('draft');
        setError(null);
        setDraftResult(null);
        setSources([]);
        setGeneratedImage(null);
        setIsEditing(false);
        setPptxUrl(null);
        setPptxError(null);
        setGammaThemes([]);
        setSelectedGammaTheme('');

        try {
            // Process all uploaded files into the format required by the Gemini API.
            const fileParts: GeminiPart[] = await Promise.all(
                knowledgeBaseFiles.map(async (file): Promise<GeminiPart> => {
                    const fileType = file.type;
                    const fileName = file.name.toLowerCase();
            
                    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx')) {
                        const textContent = await convertExcelToText(file);
                        return { text: `Conteúdo do arquivo Excel "${file.name}":\n\n${textContent}` };
                    } else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
                        const textContent = await fileToText(file);
                        return { text: `Conteúdo do arquivo CSV "${file.name}":\n\n${textContent}` };
                    } else if (file.type.startsWith('image/')) {
                         const base64Data = await fileToBase64(file);
                        return {
                            inlineData: {
                                mimeType: file.type,
                                data: base64Data,
                            },
                        };
                    } else {
                         const base64Data = await fileToBase64(file);
                         return {
                             inlineData: {
                                 mimeType: file.type,
                                 data: base64Data,
                             },
                         };
                    }
                })
            );

            const clientName = clientGroups.flatMap(g => g.clients).find(c => c.id === selectedClient)?.name;
            const fileNames = knowledgeBaseFiles.map(f => f.name).join(', ');

            // Construct the detailed user prompt.
            const userPrompt = `Gere um rascunho de relatório para o cliente "${clientName}".
**Detalhes do Projeto:**
- **Nome da Campanha:** ${campaignName || 'Não especificado'}
- **Briefing Principal:** "${brief}"
- **Arquivos Anexados para Análise:** ${fileNames.length > 0 ? fileNames : 'Nenhum'}.`;
            
            const { text, groundingChunks } = await generateReportDraft(selectedTheme, userPrompt, fileParts, useGoogleSearch, selectedTone);
            setDraftResult(text);
            setEditedDraft(text);
            if (groundingChunks) {
                setSources(groundingChunks);
            }

            // Generate suggestions for the creative prompts
            setLoadingSuggestions(true);
            try {
                console.log("Generating suggestions for prompts...");
                const [promptSuggestion, styleSuggestion] = await Promise.all([
                    generateImagePromptSuggestion(text),
                    generateImageStyleSuggestion(text),
                ]);
                setImagePrompt(promptSuggestion);
                setImageStylePrompt(styleSuggestion);
                console.log("Suggestions generated:", { promptSuggestion, styleSuggestion });
            } catch (suggestionError) {
                console.error("Failed to generate prompt suggestions:", suggestionError);
                // Non-critical error, so we don't show it to the user.
            } finally {
                setLoadingSuggestions(false);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
        } finally {
            setLoading(null);
        }
    }, [brief, selectedClient, selectedTheme, knowledgeBaseFiles, clientGroups, campaignName, selectedTone, useGoogleSearch]);
    
    /** Handler to generate a symbolic image based on the draft's content. */
    const handleSubmitImageGeneration = useCallback(async () => {
        if (!draftResult) {
            setError('Gere um rascunho primeiro para criar uma imagem.');
            return;
        }
        setLoading('image');
        setError(null);
        setGeneratedImage(null);
        try {
            const finalPrompt = imagePrompt || `Crie uma imagem simbólica e abstrata que represente os conceitos chave do seguinte relatório:\n\n---\n${draftResult}\n---`;
            const imageUrl = await generateImageFromText(finalPrompt);
            setGeneratedImage(imageUrl);
        } catch (err)
 {
            setError(err instanceof Error ? err.message : 'Ocorreu um erro ao gerar a imagem.');
        } finally {
            setLoading(null);
        }
    }, [draftResult, imagePrompt]);

    /** Handler to generate a PPTX file from the final draft using the Gamma API. */
    const handleGeneratePptx = useCallback(async () => {
        if (!draftResult || !selectedGammaTheme) return;
        setIsPptLoading(true);
        setPptxError(null);
        setPptxUrl(null);
        try {
            const downloadUrl = await generatePresentation(draftResult, selectedGammaTheme, imageStylePrompt);
            setPptxUrl(downloadUrl);
        } catch (err) {
            console.error("Failed to generate PPTX:", err);
            if (err instanceof Error) {
                setPptxError(err.message);
            } else {
                setPptxError('Ocorreu um erro desconhecido ao gerar o PPTX.');
            }
        } finally {
            setIsPptLoading(false);
        }
    }, [draftResult, selectedGammaTheme, imageStylePrompt]);


    // --- RENDER LOGIC ---

    return (
        <div className="container mx-auto px-4">
            <div className="bg-white p-6 md:p-8 border border-gray-200/80 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Gerador de Relatórios MARI</h2>
                    {draftResult && (
                        <button onClick={resetGeneratorState} className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                             <RefreshCwIcon />
                            <span className="ml-2 hidden sm:inline">Gerar Novo Relatório</span>
                        </button>
                    )}
                </div>
                {!draftResult && <p className="text-center text-gray-600 mb-8">Siga os passos para configurar e gerar seu relatório estratégico.</p>}

                {!draftResult && <Stepper currentStep={step} />}

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">{error}</div>}

                {/* Conditional rendering for the multi-step form */}
                <div className={draftResult ? 'hidden' : 'block'}>
                    {/* --- STEP 1: DEFINITION --- */}
                    <div className={step === 1 ? 'block' : 'hidden'}>
                         <div className="space-y-8">
                            {/* Client & Theme Card */}
                            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-semibold mb-4 text-gray-800">Parâmetros Principais</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                                        <select id="client" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white">
                                            {clientGroups.map(group => (
                                                <optgroup label={group.type} key={group.type}>
                                                    {group.clients.map(client => (
                                                        <option key={client.id} value={client.id}>{client.name}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="theme" className="block text-sm font-medium text-gray-700 mb-2">Tema do Relatório</label>
                                        <select id="theme" value={selectedTheme} onChange={e => setSelectedTheme(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white">
                                            {themes.map(theme => <option key={theme} value={theme}>{theme}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            {/* Campaign & Tone Card */}
                            <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                                <h3 className="text-lg font-semibold mb-4 text-gray-800">Contexto e Estilo</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="campaignName" className="block text-sm font-medium text-gray-700 mb-2">Nome da Campanha <span className="text-gray-500">(Opcional)</span></label>
                                        <input type="text" id="campaignName" value={campaignName} onChange={e => setCampaignName(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white" placeholder="Ex: Lançamento de Verão" />
                                    </div>
                                    <div>
                                        <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-2">Tom do Relatório</label>
                                        <select id="tone" value={selectedTone} onChange={e => setSelectedTone(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white">
                                            {tones.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 text-right">
                                 <button onClick={() => setStep(2)} className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Próximo &rarr;</button>
                            </div>
                        </div>
                    </div>

                    {/* --- STEP 2: CONTENT --- */}
                    <div className={step === 2 ? 'block' : 'hidden'}>
                        <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                             <h3 className="text-lg font-semibold mb-4 text-gray-800">Briefing e Fontes de Dados</h3>
                            <div className="mb-6">
                                <label htmlFor="brief" className="block text-sm font-medium text-gray-700 mb-2">Briefing e Objetivos</label>
                                <textarea id="brief" value={brief} onChange={e => setBrief(e.target.value)} rows={5} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white" placeholder="Ex: Analisar os resultados da campanha do último trimestre para o cliente X, focando no ROI e engajamento..."></textarea>
                            </div>
                            <div>
                                <h4 className="text-md font-semibold mb-3 text-gray-700">Base de Conhecimento Principal</h4>
                                <p className="text-sm text-gray-600 mb-4">Anexe os arquivos que servirão de base para o relatório (PDFs, Excel, CSV, Imagens). Esta é a fonte de informação mais importante para a IA.</p>
                                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                                    <label className="cursor-pointer">
                                        <UploadIcon />
                                        <p className="mt-2 text-sm text-gray-600">Arraste e solte ou <span className="text-blue-600 font-semibold">clique para selecionar</span></p>
                                        <input type="file" className="hidden" multiple={true} accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp" onChange={(e) => handleFileChange(e.target.files)} />
                                    </label>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {knowledgeBaseFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-white p-2 rounded-md border">
                                            <div className="flex items-center min-w-0">
                                                {file.type.startsWith('image/') ? <ImageIcon className="w-5 h-5 text-gray-500" /> : <FileIcon />}
                                                <span className="ml-2 text-sm text-gray-700 truncate">{file.name}</span>
                                            </div>
                                            <button onClick={() => removeFile(index)} className="text-gray-500 hover:text-red-600 flex-shrink-0 ml-2">
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             <div className="mt-6 flex justify-between">
                                <button onClick={() => setStep(1)} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">&larr; Voltar</button>
                                 <button onClick={() => setStep(3)} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">Próximo &rarr;</button>
                            </div>
                        </div>
                    </div>
                    
                    {/* --- STEP 3: GENERATION --- */}
                    <div className={step === 3 ? 'block' : 'hidden'}>
                         <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Finalizar e Gerar</h3>
                             <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6 flex items-center justify-between">
                                <div className="flex items-center">
                                    <GlobeIcon />
                                    <div className="ml-3">
                                        <h4 className="font-semibold text-blue-900">Pesquisa Google</h4>
                                        <p className="text-sm text-blue-800">Permitir que a IA pesquise na web por informações e contextos atualizados.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={useGoogleSearch} onChange={(e) => setUseGoogleSearch(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button onClick={handleSubmitDraft} disabled={!!loading} className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400">
                                    <SparklesIcon /> <span className="ml-2">Gerar Rascunho</span>
                                    {loading === 'draft' && <span className="animate-spin ml-2 h-5 w-5 border-t-2 border-r-2 border-white rounded-full"></span>}
                                </button>
                            </div>
                             <div className="mt-6">
                                <button onClick={() => setStep(2)} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">&larr; Voltar</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- RESULTS DISPLAY --- */}
                {draftResult && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-bold text-gray-800">Rascunho Gerado <span className="text-sm font-normal text-gray-500">(com Gemini 2.5 Pro)</span></h3>
                             <div className="flex items-center gap-2">
                                {!isEditing && (
                                    <>
                                        <button onClick={() => { setIsEditing(true); }} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                            <EditIcon /> <span className="ml-2">Editar</span>
                                        </button>
                                        <button onClick={handleCopyToClipboard} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                                            <ClipboardIcon /> <span className="ml-2">{copySuccess || 'Copiar'}</span>
                                        </button>
                                        <button onClick={handleDownload} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700">
                                            <DownloadIcon /> <span className="ml-2">Baixar .md</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Editable textarea or rendered markdown */}
                        {isEditing ? (
                            <div>
                                <textarea
                                    value={editedDraft}
                                    onChange={(e) => setEditedDraft(e.target.value)}
                                    className="block w-full h-96 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-4 font-mono text-sm"
                                />
                                <div className="flex justify-end gap-2 mt-4">
                                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancelar</button>
                                    <button onClick={handleSaveEdit} className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                                        <SaveIcon /> <span className="ml-2">Salvar Rascunho</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-blue max-w-none p-4 bg-gray-50 rounded-lg border" dangerouslySetInnerHTML={{ __html: parsedDraft }}></div>
                        )}
                        
                        {/* Action buttons for post-generation tasks */}
                        <div className="mt-6 space-y-4">
                           <div>
                                <label htmlFor="image-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                                    Prompt para a Imagem de Capa {loadingSuggestions && <span className="text-gray-500 font-normal animate-pulse">- gerando sugestão...</span>}
                                </label>
                                <div className="flex gap-2">
                                <input 
                                    id="image-prompt"
                                    type="text"
                                    value={imagePrompt}
                                    onChange={e => setImagePrompt(e.target.value)}
                                    placeholder={loadingSuggestions ? "Analisando relatório para sugerir um prompt..." : "Ex: Uma representação visual do crescimento da marca..."}
                                    className="flex-grow block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    disabled={!!loading || isEditing || loadingSuggestions}
                                />
                                <button onClick={handleSubmitImageGeneration} disabled={!!loading || isEditing} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400">
                                    <ImageIcon className="w-5 h-5"/> <span className="ml-2">Gerar Imagem</span>
                                    {loading === 'image' && <span className="animate-spin ml-2 h-5 w-5 border-t-2 border-r-2 border-blue-500 rounded-full"></span>}
                                </button>
                                </div>
                           </div>
                        </div>
                        
                        {/* PPTX generation section */}
                        <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <h4 className="font-semibold text-lg text-gray-800 mb-4">Exportar Apresentação (PPTX)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="gamma-theme" className="block text-sm font-medium text-gray-700 mb-1">1. Selecione um Tema de Apresentação</label>
                                    <select
                                        id="gamma-theme"
                                        value={selectedGammaTheme}
                                        onChange={e => setSelectedGammaTheme(e.target.value)}
                                        disabled={loadingThemes || gammaThemes.length === 0 || isPptLoading}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white disabled:bg-gray-100"
                                    >
                                        <option value="" disabled>{loadingThemes ? "Carregando temas..." : "Selecione um tema"}</option>
                                        {gammaThemes.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="image-style" className="block text-sm font-medium text-gray-700 mb-1">
                                        2. Descreva o Estilo das Imagens {loadingSuggestions && <span className="text-gray-500 font-normal animate-pulse">- gerando sugestão...</span>}
                                    </label>
                                     <input 
                                        id="image-style"
                                        type="text"
                                        value={imageStylePrompt}
                                        onChange={e => setImageStylePrompt(e.target.value)}
                                        placeholder={loadingSuggestions ? "Analisando relatório para sugerir um estilo..." : "Ex: corporativo, tons de azul e cinza, moderno"}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                        disabled={isPptLoading || loadingSuggestions}
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {imageStylePresets.map(preset => (
                                            <button 
                                                key={preset}
                                                onClick={() => setImageStylePrompt(preset)}
                                                disabled={isPptLoading || loadingSuggestions}
                                                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded-full hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={handleGeneratePptx} disabled={!draftResult || isEditing || isPptLoading || !selectedGammaTheme} className="w-full md:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed">
                                    <PresentationIcon /> <span className="ml-2">Gerar PPTX</span>
                                    {isPptLoading && <span className="animate-spin ml-2 h-5 w-5 border-t-2 border-r-2 border-white rounded-full"></span>}
                                </button>
                            </div>

                             {/* PPTX generation status */}
                            {pptxError && (
                                <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                                    {pptxError.startsWith('CORS_PROXY_REQUIRED:') ? (
                                        <span>
                                            Acesso ao proxy de API necessário. Por favor,{' '}
                                            <a
                                                href="https://cors-anywhere.herokuapp.com/corsdemo"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-bold underline hover:text-red-900"
                                            >
                                                clique aqui para ativar o acesso temporário
                                            </a>
                                            , e então tente novamente.
                                        </span>
                                    ) : (
                                        pptxError
                                    )}
                                </div>
                            )}
                            {pptxUrl && (
                                <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg flex justify-between items-center" role="alert">
                                    <span>Sua apresentação está pronta!</span>
                                    <a href={pptxUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                                        <DownloadIcon />
                                        <span className="ml-2">Baixar PPTX</span>
                                    </a>
                                </div>
                            )}
                        </div>
                        
                        {/* Display web sources if any were used */}
                        {sources.length > 0 && (
                            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">Fontes da Web utilizadas:</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                    {sources.map((source, i) => source.web && <li key={i}><a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{source.web.title}</a></li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Display generated image */}
                {generatedImage && (
                    <div className="mt-8 pt-6 border-t border-gray-200">
                         <h3 className="text-xl font-bold text-gray-800 mb-4">Imagem Representativa</h3>
                         <div className="bg-gray-50 rounded-lg border p-4">
                            <img src={generatedImage} alt="Imagem gerada pela IA representando o relatório" className="rounded-md shadow-md mx-auto max-w-full h-auto" />
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};