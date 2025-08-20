import React from 'react';

/**
 * Component for displaying a loading spinner.
 * Allows setting a size (`sm`, `md`, `lg`, `xl`) and custom text.
 * Intended to be shown while the app is loading data (for example, auth or forecast).
 */
const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  // Mapping between size names and Tailwind classes
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div className={`spinner ${sizeClasses[size]}`}></div>
      {text && (
        <p className="mt-4 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;