import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      {/* Animated progress bar */}
      <div className="relative w-full max-w-md h-5 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl overflow-hidden shadow-inner">
        <div className="absolute top-0 left-0 h-full w-full">
          <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 animate-[loading_2.5s_ease-in-out_infinite]"></div>
          <div className="absolute top-0 left-0 h-full w-full bg-[length:30px_30px] bg-repeat-x animate-[shimmer_2s_linear_infinite]"
               style={{
                 backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 25%, transparent 50%)`
               }}></div>
        </div>
      </div>

      {/* Spinning circle */}
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 animate-spin"></div>
        <div className="absolute inset-1.5 rounded-full bg-white dark:bg-gray-800"></div>
        <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 animate-pulse"></div>
      </div>

      {/* Loading text */}
      {text && (
        <p className={`bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent font-semibold ${textSizeClasses[size]} animate-pulse`}>
          {text}
        </p>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%) }
          50% { transform: translateX(0%) }
          100% { transform: translateX(100%) }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) }
          100% { transform: translateX(100%) }
        }
      `}</style>
    </div>
  );
};


