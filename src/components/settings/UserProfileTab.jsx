import React from 'react';

const UserProfileTab = ({ settings, setSettings }) => {
  const PRODUCTS = [
    'nLight Wired', 'nLight Air', 'SensorSwitch', 'SensorSwitch Air',
    'Visual Installer', 'Visual Controls', 'Fresco', 'Pathway',
    'Animate', 'Pharos', 'DALI', 'Atrius',
    'Modulus', 'DC2DC', 'Envysion Graphics', 'nFloorplan Graphics',
    'SensorView', 'BACnet'
  ];
  
  const SKILL_LABELS = ['No Knowledge', 'Basic', 'Intermediate', 'Advanced', 'Expert', 'Master'];
  const SKILL_COLORS = [
    'bg-gray-400', 
    'bg-error-500', 
    'bg-warning-500', 
    'bg-warning-400', 
    'bg-info-500', 
    'bg-success-500'
  ];
  
  const getSkillColorClass = (level) => SKILL_COLORS[level] || SKILL_COLORS[0];
  const getSkillLabel = (level) => SKILL_LABELS[level] || SKILL_LABELS[0];
  
  const handleProductKnowledgeChange = (product, value) => {
    const level = parseInt(value);
    setSettings(prev => ({
      ...prev,
      workloadSettings: {
        ...prev.workloadSettings,
        productKnowledge: {
          ...(prev.workloadSettings?.productKnowledge || {}),
          [product]: level
        }
      }
    }));
  };
  
  const getProductKnowledge = (product) => {
    return settings.workloadSettings?.productKnowledge?.[product] || 0;
  };

  return (
    <div className="space-y-6">
      {/* User Profile Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>👤</span>
            <span>User Profile</span>
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage your personal information and settings</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Your Name */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Your Name</label>
            <input
              type="text"
              value={settings.workloadSettings?.userName || ''}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                workloadSettings: {
                  ...prev.workloadSettings,
                  userName: e.target.value
                }
              }))}
              placeholder="John Smith"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Your Email */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Your Email</label>
            <input
              type="email"
              value={settings.workloadSettings?.userEmail || ''}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                workloadSettings: {
                  ...prev.workloadSettings,
                  userEmail: e.target.value
                }
              }))}
              placeholder="john.smith@acuity.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
            <select
              value={settings.workloadSettings?.position || ''}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                workloadSettings: {
                  ...prev.workloadSettings,
                  position: e.target.value
                }
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select your role...</option>
              <option value="L&T Junior Design Application Analyst">L&T Junior Design Application Analyst</option>
              <option value="L&T Senior Design Application Analyst">L&T Senior Design Application Analyst</option>
              <option value="Junior Design Application Analyst">Junior Design Application Analyst</option>
              <option value="Senior Design Application Analyst">Senior Design Application Analyst</option>
              <option value="Lead Design Application Analyst">Lead Design Application Analyst</option>
              <option value="Manager Design Application Analyst">Manager Design Application Analyst</option>
            </select>
          </div>

          {/* Years of Experience */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Years of Experience</label>
            <input
              type="number"
              value={settings.workloadSettings?.yearsExperience || 0}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                workloadSettings: {
                  ...prev.workloadSettings,
                  yearsExperience: parseInt(e.target.value) || 0
                }
              }))}
              min="0"
              max="50"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Weekly Capacity */}
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Weekly Capacity (hours)</label>
            <input
              type="number"
              value={settings.workloadSettings?.weeklyCapacity || 40}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                workloadSettings: {
                  ...prev.workloadSettings,
                  weeklyCapacity: parseInt(e.target.value) || 40
                }
              }))}
              min="0"
              max="168"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Maximum hours per week you can work (168 hours = 1 week)</p>
          </div>
        </div>
      </div>

      {/* Product Knowledge Section */}
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>🎯</span>
            <span>Product Knowledge</span>
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Rate your knowledge level for each product (0 = No Knowledge, 5 = Master)
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PRODUCTS.map(product => {
            const level = getProductKnowledge(product);
            const colorClass = getSkillColorClass(level);
            
            return (
              <div 
                key={product} 
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {product}
                  </label>
                  <span className={`text-xs font-semibold px-2 py-1 rounded text-white ${colorClass}`}>
                    {level}/5
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    value={level}
                    onChange={(e) => handleProductKnowledgeChange(product, e.target.value)}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    style={{
                      background: level > 0 
                        ? `linear-gradient(to right, 
                            ${level >= 5 ? '#10b981' : level >= 4 ? '#3b82f6' : level >= 3 ? '#fbbf24' : level >= 2 ? '#f59e0b' : '#ef4444'} 0%, 
                            ${level >= 5 ? '#10b981' : level >= 4 ? '#3b82f6' : level >= 3 ? '#fbbf24' : level >= 2 ? '#f59e0b' : '#ef4444'} ${(level / 5) * 100}%, 
                            #e5e7eb ${(level / 5) * 100}%, 
                            #e5e7eb 100%)`
                        : '#e5e7eb'
                    }}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[90px] text-right">
                    {getSkillLabel(level)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UserProfileTab;

