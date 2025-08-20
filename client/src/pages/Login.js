import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  // אחסון שדות הטופס באובייקט אחד — מפשט ניהול והעברה ל-API
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  // חשיפת/הסתרת סיסמה — שיקול שימושיות (להפחתת טעויות הקלדה)
  const [showPassword, setShowPassword] = useState(false);
  // מצב טעינה — מונע שליחה כפולה ומאפשר פידבק למשתמש
  const [loading, setLoading] = useState(false);
  // שגיאות ברמת השדה — מאפשר הצגת הודעה מתחת לקלט ספציפי
  const [errors, setErrors] = useState({});

  const { login } = useAuth();        // תלות יחידה בהקשר אימות — לא מחזיקים state כפול
  const navigate = useNavigate();     // ניווט SPA לאחר התחברות מוצלחת

  const handleChange = (e) => {
    const { name, value } = e.target;
    // עדכון שדה ספציפי בלי לדרוס שאר השדות
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // UX: ניקוי הודעת שגיאה מייד כשמתחילים להקליד בשדה הבעייתי
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // ולידציה בסיסית ומהירה בצד לקוח — חוסך קריאת שרת מיותרת
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    // אמת רק אם אין שגיאות כלל
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); // מניעת רענון דף ברירת מחדל של טופס
    
    if (!validateForm()) {
      return; // עוצרים כאן — אין טעם לקרוא לשרת עם נתונים לא תקינים
    }

    setLoading(true); // נעילת הכפתור והצגת "Signing in..."
    
    try {
      // קריאה מרוכזת לשכבת auth — החלטה ארכיטקטונית: לוגיקה עסקית לא בקומפוננטה
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        toast.success('Login successful!'); // פידבק חיובי מיידי
        navigate('/plan');                  // החלטה מוצרית: אחרי התחברות שולחים ישר לתכנון טיול
      } else {
        toast.error(result.error);          // הודעת שגיאה ידידותית מהשרת
      }
    } catch (error) {
      // רשת/שגיאה בלתי צפויה — הודעה כללית כדי לא לחשוף פרטים מיותרים
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false); // שחרור כפתור בכל מקרה
    }
  };

  return (
    // מבנה מרכזי: מיכל אנכי ממורכז בכל המסך לשמירה על פוקוס יחיד (התחברות)
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Welcome Back
          </h2>
          {/* טקסט משני — מסביר תועלת (להמשיך תכנון), מחזק מוטיבציה */}
          <p className="mt-2 text-gray-600">
            Sign in to your account to continue planning your adventures
          </p>
        </div>

        <div className="card">
          {/* טופס עם רווחים קבועים — קל לסריקה בעין, משפר נגישות */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              {/* שימוש ב-label מקושר ל-id — חיוני לנגישות וקליק על הטקסט */}
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                {/* אייקון לאינדיקציה ויזואלית — pointer-events-none כדי לא לתפוס קליקים */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  // שילוב מחלקת שגיאה רק כשצריך — משוב מיידי למשתמש
                  className={`input pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'} // טוגל בין טקסט לסיסמה
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className={`input pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  placeholder="Enter your password"
                />
                {/* כפתור חשיפת סיסמה — בצד ימין, לא שולח את הטופס (type="button") */}
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            <div>
              {/* הכפתור ננעל בזמן טעינה — מונע לחיצות כפולות ושליחות מקבילות */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary py-3 text-base font-medium"
              >
                {loading ? (
                  // חיווי חזותי קצר במקום טקסט בלבד — מבהיר שיש פעולה מתבצעת
                  <div className="flex items-center justify-center">
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* קישור להרשמה — מסייע להמרה אם המשתמש עדיין בלי חשבון */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;