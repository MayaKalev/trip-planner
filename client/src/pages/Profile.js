import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { User, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateProfile, changePassword } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // נשאר רק שם ואימייל
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  if (!user) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await updateProfile(profileForm); // שולחים רק name, email
      if (result.success) {
        toast.success('Profile updated successfully');
      } else {
        toast.error(result.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      const result = await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );
      if (result.success) {
        toast.success('Password changed successfully');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(result.error || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-body text-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-12 w-12 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{user?.name}</h2>
              <p className="text-gray-600 mb-4">{user?.email}</p>
              <div className="text-sm text-gray-500">
                Member since {new Date(user?.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'password'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Password
            </button>
          </div>

          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Profile Settings</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      className="input"
                      required
                    />
                  </div>

                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? (
                      <div className="flex items-center">
                        <div className="spinner w-4 h-4 mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Password Settings */}
          {activeTab === 'password' && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={handlePasswordChange}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      className="input"
                      required
                    />
                  </div>

                  <button type="submit" disabled={saving} className="btn btn-primary">
                    {saving ? (
                      <div className="flex items-center">
                        <div className="spinner w-4 h-4 mr-2"></div>
                        Changing Password...
                      </div>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
