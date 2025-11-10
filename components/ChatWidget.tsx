
import React, { useState, useRef, useEffect } from 'react';
import { Chat, GoogleGenAI } from '@google/genai';
import { MessageSquareIcon, SendIcon, XIcon, BotIcon, UserIcon } from './icons';

/**
 * Interface representing a single message in the chat history.
 */
interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

/**
 * Generates the initial system instruction for the chatbot based on whether a report has been generated.
 * @param {string | null} reportContext - The content of the generated report, or null if none exists.
 * @returns {string} The system instruction for the Gemini chat model.
 */
const getInitialSystemInstruction = (reportContext: string | null): string => {
    if (reportContext) {
        // If a report exists, the chat becomes a Q&A assistant for that specific report.
        return `Você é MARI, uma assistente de IA da agência Artplan. Sua tarefa agora é responder perguntas sobre o rascunho de relatório que acabou de ser gerado. Seja prestativa, precisa e baseie suas respostas exclusivamente no conteúdo fornecido abaixo. Não invente informações.

--- CONTEÚDO DO RELATÓRIO ---
${reportContext}
--- FIM DO CONTEÚDO ---`;
    }
    // Default behavior when no report is active.
    return 'Você é MARI, uma assistente de IA da agência Artplan. Seja prestativa, amigável e concisa em suas respostas.';
};

/**
 * A floating chat widget component for user interaction with the MARI AI assistant.
 * It can function as a general assistant or as a context-aware Q&A bot for a generated report.
 * @param {object} props - The component props.
 * @param {string | null} props.reportContext - The content of the generated report.
 * @returns {React.FC} The ChatWidget component.
 */
export const ChatWidget: React.FC<{ reportContext: string | null }> = ({ reportContext }) => {
    // --- STATE MANAGEMENT ---
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);

    // Refs for managing the chat instance and auto-scrolling
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    /**
     * Effect to initialize or reset the chat session when the widget is opened/closed
     * or when the report context changes.
     */
    useEffect(() => {
        if (isOpen) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
                const systemInstruction = getInitialSystemInstruction(reportContext);

                // Create a new chat instance with the appropriate system instruction.
                chatRef.current = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction }
                });

                // Set the initial greeting message based on context.
                const initialMessage = reportContext 
                    ? 'Olá! O rascunho do seu relatório foi gerado. Sobre o que você gostaria de perguntar?'
                    : 'Olá! Sou a MARI. Como posso te ajudar hoje?';

                setMessages([{ role: 'model', text: initialMessage }]);
            } catch (e) {
                console.error("Failed to initialize chat:", e);
                setMessages([{ role: 'model', text: 'Desculpe, não consegui iniciar o chat. Verifique a configuração da API.' }]);
            }
        } else {
            // Cleanup on close.
            chatRef.current = null;
            setMessages([]);
        }
    }, [isOpen, reportContext]);


    /**
     * Effect to automatically scroll to the latest message.
     */
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    /**
     * Handles the form submission to send a message to the chat model.
     * It uses the `sendMessageStream` method to receive and render the response in chunks.
     */
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading || !chatRef.current) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const result = await chatRef.current.sendMessageStream({ message: input });
            let text = '';
            let modelMessageExists = false;

            // Process the streaming response chunk by chunk.
            for await (const chunk of result) {
                text += chunk.text;
                setMessages(prev => {
                    // This logic updates the last message in-place for a smooth streaming effect.
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage.role === 'model') {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = { ...lastMessage, text: text };
                        return newMessages;
                    } else if (!modelMessageExists) {
                        // If this is the first chunk, add a new model message to the array.
                        modelMessageExists = true;
                        return [...prev, { role: 'model', text: text }];
                    }
                    return prev; // Should not happen, but a safe fallback.
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'model', text: 'Desculpe, ocorreu um erro.' }]);
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER LOGIC ---

    return (
        <>
            {/* Floating action button to toggle the chat widget */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-50"
                aria-label="Toggle Chat"
            >
                {isOpen ? <XIcon /> : <MessageSquareIcon />}
            </button>

            {/* The main chat window */}
            <div className={`fixed bottom-24 right-6 w-full max-w-sm h-[60vh] flex flex-col z-50 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-2xl flex flex-col w-full h-full border border-gray-200">
                    <header className="bg-white/50 backdrop-blur-sm p-4 rounded-t-2xl border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-800">Fale com a MARI</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
                            <XIcon className="w-5 h-5"/>
                        </button>
                    </header>

                    {/* Message display area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><BotIcon /></div>}
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                                    <p className="text-sm">{msg.text}</p>
                                </div>
                                {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"><UserIcon /></div>}
                            </div>
                        ))}
                        {/* Loading indicator for when the model is "typing" */}
                        {loading && (
                           <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><BotIcon /></div>
                                <div className="rounded-2xl px-4 py-2 bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm">
                                    <div className="flex items-center space-x-1">
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-0"></span>
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-150"></span>
                                        <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-300"></span>
                                    </div>
                                </div>
                           </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Message input form */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white/50 backdrop-blur-sm rounded-b-2xl">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Digite sua pergunta..."
                                className="w-full pr-12 pl-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                disabled={loading}
                            />
                            <button type="submit" disabled={loading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors">
                                <SendIcon />
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};
