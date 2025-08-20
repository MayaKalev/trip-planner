import React from 'react';

/**
 * קומפוננטה להצגת Spinner של טעינה.
 * מאפשרת לקבוע גודל (`sm`, `md`, `lg`, `xl`) וטקסט מותאם אישי.
 * מיועדת להצגה בזמן שהמערכת טוענת נתונים (כמו Auth או תחזית).
 */
const LoadingSpinner = ({ size = 'md', text = 'Loading...' }) => {
  // מיפוי בין שמות גודל למחלקות Tailwind
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      {/* עיגול מסתובב (spinner) בגודל נבחר */}
      <div className={`spinner ${sizeClasses[size]}`}></div>

      {/* טקסט מתחת לספינר – אם הוגדר */}
      {text && (
        <p className="mt-4 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;