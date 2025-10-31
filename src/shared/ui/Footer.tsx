import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
         <footer className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700">
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
         <div className="text-center">
           <p className="text-gray-600 dark:text-gray-400 text-sm">
             © {currentYear} AI Research Assistant. All Rights Reserved.
           </p>
         </div>
       </div>
     </footer>
  );
};
