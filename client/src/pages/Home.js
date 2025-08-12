import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <section className="text-center py-16">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          Plan Your Perfect
          <span className="text-blue-600"> Trip</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Discover amazing hiking and cycling routes with AI-powered planning, 
          weather forecasts, and interactive maps. Your next adventure starts here.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {user ? (
            <>
              <Link to="/plan" className="btn btn-primary text-lg px-8 py-3">
                Plan New Trip
              </Link>
              <Link to="/routes" className="btn btn-secondary text-lg px-8 py-3">
                View My Routes
              </Link>
            </>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
                Get Started Free
              </Link>
              <Link to="/login" className="btn btn-secondary text-lg px-8 py-3">
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Home;
