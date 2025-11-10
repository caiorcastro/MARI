# MARI - Máquina de Análises, Reports & Insights

MARI é uma aplicação web sofisticada, potencializada por IA, projetada para a agência de mídia moderna. Ela utiliza o poder da API Google Gemini para transformar dados brutos de briefings, planilhas e PDFs em rascunhos de relatórios estrategicamente densos e acionáveis em minutos, não em dias. Com um fluxo de trabalho guiado, chat contextual e geração automatizada de apresentações, a MARI otimiza todo o processo de criação de relatórios, desde a entrada de dados até um arquivo PowerPoint pronto para o cliente.

## ✨ Principais Funcionalidades

- **Geração de Relatórios com IA:** Utiliza os modelos `gemini-2.5-flash` e `gemini-2.5-pro` para analisar dados e gerar rascunhos de relatórios de alta qualidade.
- **Fluxo de Trabalho Guiado em Múltiplas Etapas:** Um "stepper" intuitivo guia os usuários na definição do relatório, adição de conteúdo e geração do resultado.
- **Base de Conhecimento Rica:** Suporta o upload de múltiplos tipos de arquivos (`.pdf`, `.xlsx`, `.csv`) para servirem como a principal fonte de dados para análise.
- **Processamento de Arquivos no Cliente:** Processa de forma segura arquivos Excel e CSV diretamente no navegador para extrair conteúdo textual para a IA.
- **Chat com IA Contextual:** Um widget de chat com `gemini-2.5-flash` torna-se ciente do contexto após a geração de um relatório, permitindo que os usuários façam perguntas de acompanhamento sobre o documento.
- **"Thinking Mode" para Análise Profunda:** Uma função dedicada usa o `gemini-2.5-pro` com seu orçamento máximo de "thinking" para realizar uma análise mais profunda e detalhada do rascunho inicial.
- **Geração Automatizada de PPTX:** Integra-se com a **API Gamma** para transformar o rascunho final do relatório em um arquivo de apresentação `.pptx` para download.
- **Geração de Imagem Simbólica:** Usa o `gemini-2.5-flash-image` para criar uma imagem simbólica e abstrata que representa visualmente os temas centrais do relatório.
- **Engenharia de Prompt Dinâmica:** Os temas e tons do relatório selecionados pelo usuário alteram dinamicamente as instruções enviadas para a IA, garantindo resultados altamente personalizados e relevantes.
- **Busca na Web (Grounding):** Opcionalmente, utiliza a Pesquisa Google para enriquecer os relatórios com informações atualizadas e contexto da web.
- **Identidade Visual Artplan:** O logo da Artplan está integrado no cabeçalho e no rodapé da aplicação.

## 🚀 Tecnologias Utilizadas

- **Frontend:** React, TypeScript, Tailwind CSS
- **IA & ML:** Google Gemini API (`@google/genai`)
- **API de Apresentação:** Gamma API
- **Utilitários:** SheetJS (`xlsx`) para processamento de Excel, Marked para renderização de Markdown

## 🛠️ Configuração e Execução do Projeto

Esta aplicação foi projetada para rodar em um ambiente seguro onde as chaves de API são gerenciadas como variáveis de ambiente.

1.  **Chaves de API:**
    -   **Google Gemini API Key:** A aplicação espera que uma `API_KEY` esteja disponível em seu ambiente (`process.env.API_KEY`). Ela é usada para todas as interações com os modelos Gemini.
    -   **Gamma API Key:** O serviço da Gamma (`services/gamma.ts`) requer uma chave de API para gerar apresentações. Atualmente, ela está definida diretamente no código para fins de demonstração, mas deve ser uma variável de ambiente (`process.env.GAMMA_API_KEY`) em uma configuração de produção.

2.  **Instalação:**
    ```bash
    # (Assumindo um ambiente Node.js padrão)
    npm install
    ```

3.  **Executando a Aplicação:**
    ```bash
    npm run dev
    ```

## 📋 Como Usar

A aplicação segue um processo simples de três etapas para gerar um relatório.

1.  **Etapa 1: Definição**
    -   **Selecione um Cliente:** Escolha de uma lista categorizada de clientes.
    -   **Escolha um Tema:** Selecione um tema de relatório (ex: "Planejamento de Mídia", "Análise de Social Media"). Essa escolha influencia fortemente o foco da IA.
    -   **Forneça um Nome de Campanha (Opcional):** Adicione um contexto específico para o relatório.
    -   **Selecione um Tom:** Escolha o estilo de escrita desejado (ex: "Estratégico", "Técnico").

2.  **Etapa 2: Conteúdo**
    -   **Escreva o Briefing:** Detalhe os principais objetivos e metas do relatório.
    -   **Faça Upload dos Arquivos:** Arraste e solte ou selecione todos os arquivos de origem relevantes (`.pdf`, `.xlsx`, `.csv`). Esta é a **Base de Conhecimento** que a IA usará primariamente para sua análise.

3.  **Etapa 3: Geração**
    -   **Habilitar Pesquisa Google (Opcional):** Permita que a IA pesquise na web por contexto adicional.
    -   **Gerar Rascunho:** Clique em "Gerar Rascunho". A IA processará todas as informações e criará o rascunho inicial.

4.  **Fluxo de Trabalho Pós-Geração:**
    -   **Revise e Edite:** O relatório gerado em markdown é exibido. Você pode editá-lo diretamente no aplicativo.
    -   **Realize uma Análise Profunda:** Use o botão "Análise Profunda" para obter uma análise mais detalhada de um modelo de IA mais poderoso.
    -   **Gere uma Imagem:** Crie uma imagem simbólica baseada no conteúdo do relatório.
    -   **Gere o PPTX:** Quando estiver satisfeito com o rascunho, clique em "Gerar PPTX" para criar e baixar uma apresentação PowerPoint via API da Gamma.
    -   **Converse com seu Relatório:** Use o widget de chat no canto inferior direito para fazer perguntas específicas sobre o conteúdo gerado.

## 📁 Estrutura de Arquivos

```
.
├── components/       # Componentes React reutilizáveis
│   ├── App.tsx             # Componente principal da aplicação
│   ├── Header.tsx          # Cabeçalho do site
│   ├── ReportGenerator.tsx # Componente principal para o formulário de etapas e geração de relatórios
│   ├── ChatWidget.tsx      # Componente do chat flutuante
│   └── icons.tsx           # Componentes de ícones SVG
├── services/         # Módulos para comunicação com APIs externas
│   ├── gemini.ts           # Gerencia todas as interações com a API Google Gemini
│   └── gamma.ts            # Gerencia as interações com a API Gamma
├── utils/            # Funções auxiliares
│   └── fileHelper.ts       # Funções para processamento de arquivos (Base64, parsing de Excel)
└── types.ts          # Definições de tipos TypeScript
```
