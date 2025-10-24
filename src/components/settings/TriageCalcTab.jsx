import React from 'react';

const TriageCalcTab = ({ settings, setSettings }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <span>🧮</span>
          <span>Calculation Settings</span>
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Configure multipliers and thresholds for triage calculations</p>
        
        <div className="space-y-6">
          {/* LMP Multipliers */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              <span>LMP Multipliers (minutes)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Small:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.lmpMultipliers.small}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      lmpMultipliers: {
                        ...prev.calculationSettings.lmpMultipliers,
                        small: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Medium:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.lmpMultipliers.medium}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      lmpMultipliers: {
                        ...prev.calculationSettings.lmpMultipliers,
                        medium: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Large:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.lmpMultipliers.large}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      lmpMultipliers: {
                        ...prev.calculationSettings.lmpMultipliers,
                        large: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
          
          {/* ARP Multipliers */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔌</span>
              <span>ARP Multipliers (minutes)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ARP 8:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.arpMultipliers.arp8}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      arpMultipliers: {
                        ...prev.calculationSettings.arpMultipliers,
                        arp8: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ARP 16:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.arpMultipliers.arp16}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      arpMultipliers: {
                        ...prev.calculationSettings.arpMultipliers,
                        arp16: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ARP 32:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.arpMultipliers.arp32}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      arpMultipliers: {
                        ...prev.calculationSettings.arpMultipliers,
                        arp32: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ARP 48:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.arpMultipliers.arp48}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      arpMultipliers: {
                        ...prev.calculationSettings.arpMultipliers,
                        arp48: parseInt(e.target.value) || 0
                      }
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
          
          {/* Room Multipliers */}
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🏠</span>
              <span>Room Multipliers</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Room Multiplier (min/room):</label>
                <input
                  type="number"
                  value={settings.calculationSettings.roomMultiplier}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      roomMultiplier: parseInt(e.target.value) || 0
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Riser Multiplier (min/room):</label>
                <input
                  type="number"
                  value={settings.calculationSettings.riserMultiplier}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      riserMultiplier: parseInt(e.target.value) || 0
                    }
                  }))}
                  min="0"
                  step="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">E-Sheets Multiplier:</label>
                <input
                  type="number"
                  value={settings.calculationSettings.esheetsMultiplier}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    calculationSettings: {
                      ...prev.calculationSettings,
                      esheetsMultiplier: parseFloat(e.target.value) || 0
                    }
                  }))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TriageCalcTab;

