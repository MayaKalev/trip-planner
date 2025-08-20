import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, User, LogOut, Menu, X, Plus, List } from 'lucide-react';
import toast from 'react-hot-toast';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /**
   * Logs the user out and shows a success message.
   */
  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  // Controls opening/closing of the mobile menu
  /*const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  */

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">

          {/* Logo and link to the home page */}
          <Link to="/" className="flex items-center space-x-2">
            <MapPin className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Trip Planner</span>
          </Link>

          {/* Desktop navigation menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors">Home</Link>

            {/* Show additional links only if the user is logged in */}
            {user && (
              <>
                <Link to="/plan" className="text-gray-600 hover:text-blue-600">Plan Trip</Link>
                <Link to="/routes" className="text-gray-600 hover:text-blue-600">My Routes</Link>
              </>
            )}
          </div>

          {/* Auth/Profile/Logout menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {/* Display user name */}
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-600" />
                  <span className="text-gray-700">{user.name}</span>
                </div>

                {/* Profile link and logout button */}
                <div className="flex items-center space-x-2">
                  <Link to="/profile" className="text-gray-600 hover:text-blue-600">Profile</Link>
                  <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 flex items-center space-x-1">
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-gray-600 hover:text-blue-600">Login</Link>
                <Link to="/register" className="btn btn-primary">Sign Up</Link>
              </div>
            )}
          </div>
          {/* Mobile menu button 
          <button onClick={toggleMenu} className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100">
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          */}
        </div>
            
        {/*isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-4">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-blue-600">Home</Link>

              {user ? (
                <>
                  <Link to="/plan" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 text-gray-600 hover:text-blue-600">
                    <Plus className="h-4 w-4" /><span>Plan Trip</span>
                  </Link>
                  <Link to="/routes" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 text-gray-600 hover:text-blue-600">
                    <List className="h-4 w-4" /><span>My Routes</span>
                  </Link>
                  <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center space-x-2 text-gray-600 hover:text-blue-600">
                    <User className="h-4 w-4" /><span>Profile</span>
                  </Link>
                  <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="flex items-center space-x-2 text-gray-600 hover:text-red-600">
                    <LogOut className="h-4 w-4" /><span>Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setIsMenuOpen(false)} className="text-gray-600 hover:text-blue-600">Login</Link>
                  <Link to="/register" onClick={() => setIsMenuOpen(false)} className="btn btn-primary">Sign Up</Link>
                </>
              )}
            </div>
          </div>
        )*/}
      </div>
    </nav>
  );
};

export default Navbar;