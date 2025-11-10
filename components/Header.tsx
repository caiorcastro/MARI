
import React from 'react';

/**
 * Renders the sticky header for the application.
 * Includes the Artplan logo which links back to the homepage (reloading the app)
 * and a descriptive subtitle.
 * @returns {React.FC} The header component.
 */
export const Header: React.FC = () => {
  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo acts as a home button, reloading the application state */}
          <a href="/" className="flex items-center">
            <img 
              src="https://grandesnomesdapropaganda.com.br/wp-content/uploads/2015/08/Marca_Artplan_rgb.png" 
              alt="Artplan Logo" 
              className="h-8 w-auto"
            />
          </a>
          <nav>
            <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors pointer-events-none">
              Máquina de Análises, Reports & Insights
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
};
