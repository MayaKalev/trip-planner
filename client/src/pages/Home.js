import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Compass, Cloud, Save, Users, Shield } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: <Compass className="h-8 w-8 text-blue-600" />,
      title: 'AI-Powered Route Planning',
      description: 'Get intelligent route suggestions for hiking and cycling trips based on your preferences and location.'
    },
    {
      icon: <Cloud className="h-8 w-8 text-green-600" />,
      title: 'Weather Integration',
      description: 'View 3-day weather forecasts for your trip destinations to plan accordingly.'
    },
    {
      icon: <Save className="h-8 w-8 text-purple-600" />,
      title: 'Save & Manage Routes',
      description: 'Save your favorite routes, add notes, and track your trip history all in one place.'
    },
    {
      icon: <MapPin className="h-8 w-8 text-red-600" />,
      title: 'Interactive Maps',
      description: 'Visualize your routes on beautiful interactive maps with detailed waypoints and elevation data.'
    },
    {
      icon: <Users className="h-8 w-8 text-indigo-600" />,
      title: 'Personal Profiles',
      description: 'Create your profile, set preferences, and customize your trip planning experience.'
    },
    {
      icon: <Shield className="h-8 w-8 text-orange-600" />,
      title: 'Secure & Private',
      description: 'Your routes and personal data are protected with industry-standard security measures.'
    }
  ];

  return (
    <div className="space-y-16">
      {/* Hero Section */}
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
                <Link
                  to="/plan"
                  className="btn btn-primary text-lg px-8 py-3"
                >
                  Plan New Trip
                </Link>
                <Link
                  to="/routes"
                  className="btn btn-secondary text-lg px-8 py-3"
                >
                  View My Routes
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  className="btn btn-primary text-lg px-8 py-3"
                >
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  className="btn btn-secondary text-lg px-8 py-3"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for Trip Planning
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our comprehensive platform provides all the tools you need to plan, 
              save, and enjoy your outdoor adventures.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card p-6 text-center">
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600">
              Get started in just a few simple steps
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Choose Your Adventure
              </h3>
              <p className="text-gray-600">
                Select your destination and trip type (hiking or cycling) 
                to get started with route planning.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Get AI-Generated Routes
              </h3>
              <p className="text-gray-600">
                Our AI creates personalized routes with realistic paths, 
                distance calculations, and weather forecasts.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Save & Explore
              </h3>
              <p className="text-gray-600">
                Save your favorite routes, view them on interactive maps, 
                and track your trip history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of outdoor enthusiasts who trust Trip Planner for their adventures.
          </p>
          {!user && (
            <Link
              to="/register"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-block"
            >
              Create Free Account
            </Link>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home; 