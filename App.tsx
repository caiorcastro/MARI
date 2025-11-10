
import React, { useState } from 'react';
import { Header } from './components/Header';
import { ReportGenerator } from './components/ReportGenerator';
import { ChatWidget } from './components/ChatWidget';

/**
 * The main application component for MARI.
 * It orchestrates the overall layout and manages the shared state between
 * the report generator and the chat widget.
 * @returns {React.FC} The root component of the application.
 */
const App: React.FC = () => {
  /**
   * State to hold the content of the generated report draft.
   * This is lifted up to the App component so it can be passed to both
   * the ReportGenerator (which sets it) and the ChatWidget (which reads it for context).
   * A value of `null` indicates no report has been generated yet.
   */
  const [reportContext, setReportContext] = useState<string | null>(null);

  return (
    <div className="bg-white min-h-screen font-sans text-gray-800 flex flex-col">
      <Header />
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Análises de <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Dias</span>,
              <br />
              Entregues em <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">Horas</span>.
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600">
              MARI é a metodologia proprietária da Artplan que usa IA para transformar dados complexos em insights acionáveis, com uma velocidade e clareza que redefinem a tomada de decisão.
            </p>
          </div>
        </div>

        {/* The core report generation component. It receives the setter function to update the shared report context. */}
        <ReportGenerator setReportContext={setReportContext} />

        {/* Quote Section */}
        <div className="bg-gray-50/70 mt-20">
          <div className="container mx-auto px-4 py-16 text-center">
            <blockquote className="max-w-4xl mx-auto">
              <p className="text-xl md:text-2xl font-medium text-gray-800">
                “Batizamos nossa metodologia de <span className="font-bold text-blue-600">MARI</span> — Máquina de Análises, Reports & Insights. Além de um acrônimo técnico, é uma homenagem a todas as mentes brilhantes que transformam dados em estratégias vitoriosas.”
              </p>
            </blockquote>
          </div>
        </div>
      </main>

      {/* The floating chat widget. It receives the current report context to enable context-aware conversations. */}
      <ChatWidget reportContext={reportContext} />

      {/* Footer Section */}
      <footer className="bg-gray-50 border-t border-gray-200 mt-16">
          <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center">
              <div className="flex items-center">
                  <img src="https://grandesnomesdapropaganda.com.br/wp-content/uploads/2015/08/Marca_Artplan_rgb.png" alt="Artplan Logo" className="h-6 w-auto" />
              </div>
              <p className="text-sm text-gray-500 mt-4 sm:mt-0">
                  © {new Date().getFullYear()} Artplan. Todos os direitos reservados.
              </p>
          </div>
      </footer>
    </div>
  );
};

export default App;
