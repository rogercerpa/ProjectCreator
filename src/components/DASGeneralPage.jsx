import React, { useState, useEffect, useCallback } from 'react';
import TeamMembersTab from './dasgeneral/TeamMembersTab';
import TrainingMaterialTab from './dasgeneral/TrainingMaterialTab';
import ProductsInfoTab from './dasgeneral/ProductsInfoTab';

const { electronAPI } = window;

// Default file path
const DEFAULT_FILE_PATH = 'Z:\\DAS References\\ProjectCreatorV5\\DASGeneral.xlsx';

function DASGeneralPage() {
  const [activeTab, setActiveTab] = useState('team-members');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    teamMembers: [],
    trainingMaterial: [],
    productsInfo: [],
    products: []
  });
  const [filePath, setFilePath] = useState(DEFAULT_FILE_PATH);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsResult = await electronAPI.dasGeneralGetSettings();
        if (settingsResult.success && settingsResult.settings?.filePath) {
          setFilePath(settingsResult.settings.filePath);
        }
      } catch (err) {
        console.warn('Failed to load DAS General settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Load data from Excel file
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First check if file is accessible
      const accessResult = await electronAPI.dasGeneralCheckAccess(filePath);
      
      if (!accessResult.success) {
        // Handle different error types
        if (accessResult.error === 'FILE_NOT_FOUND') {
          setError({
            type: 'FILE_NOT_FOUND',
            message: accessResult.message,
            canCreate: true
          });
        } else if (accessResult.error === 'FILE_LOCKED') {
          setError({
            type: 'FILE_LOCKED',
            message: accessResult.message,
            canRetry: true
          });
        } else if (accessResult.error === 'NETWORK_ERROR') {
          setError({
            type: 'NETWORK_ERROR',
            message: accessResult.message,
            canRetry: true
          });
        } else {
          setError({
            type: 'ACCESS_ERROR',
            message: accessResult.message,
            canRetry: true
          });
        }
        setIsLoading(false);
        return;
      }

      // Load the data
      const loadResult = await electronAPI.dasGeneralLoadAll(filePath);
      
      if (loadResult.success) {
        // Ensure all required arrays exist in the data
        setData({
          teamMembers: Array.isArray(loadResult.data?.teamMembers) ? loadResult.data.teamMembers : [],
          trainingMaterial: Array.isArray(loadResult.data?.trainingMaterial) ? loadResult.data.trainingMaterial : [],
          productsInfo: Array.isArray(loadResult.data?.productsInfo) ? loadResult.data.productsInfo : [],
          products: Array.isArray(loadResult.data?.products) ? loadResult.data.products : []
        });
        setLastSaved(loadResult.lastLoaded);
        setHasUnsavedChanges(false);
        setError(null);
      } else {
        setError({
          type: loadResult.error || 'LOAD_ERROR',
          message: loadResult.message || 'Failed to load data from Excel file.',
          canRetry: true
        });
      }
    } catch (err) {
      console.error('Error loading DAS General data:', err);
      setError({
        type: 'UNKNOWN_ERROR',
        message: `An unexpected error occurred: ${err.message}`,
        canRetry: true
      });
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  // Load data on mount and when file path changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create new file handler
  const handleCreateFile = async () => {
    setIsLoading(true);
    try {
      const result = await electronAPI.dasGeneralCreateFile(filePath);
      if (result.success) {
        await loadData();
      } else {
        setError({
          type: 'CREATE_ERROR',
          message: result.error || 'Failed to create file.',
          canRetry: true
        });
      }
    } catch (err) {
      setError({
        type: 'CREATE_ERROR',
        message: err.message,
        canRetry: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save all data to Excel file
  // updatedData can be a partial update (e.g., { teamMembers: [...] }) or full data
  const handleSaveAll = async (updatedData) => {
    setIsLoading(true);
    try {
      // Merge updatedData with existing data to ensure we don't lose any sheets
      const dataToSave = {
        teamMembers: updatedData?.teamMembers ?? data.teamMembers,
        trainingMaterial: updatedData?.trainingMaterial ?? data.trainingMaterial,
        productsInfo: updatedData?.productsInfo ?? data.productsInfo,
        products: updatedData?.products ?? data.products
      };
      
      const result = await electronAPI.dasGeneralSaveAll(dataToSave, filePath);
      
      if (result.success) {
        setData(dataToSave);
        setLastSaved(result.savedAt);
        setHasUnsavedChanges(false);
        return { success: true };
      } else {
        // Show error but don't update data (revert changes)
        setError({
          type: result.error || 'SAVE_ERROR',
          message: result.message || 'Failed to save data to Excel file.',
          canRetry: true,
          canDismiss: true
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      setError({
        type: 'SAVE_ERROR',
        message: err.message,
        canRetry: true,
        canDismiss: true
      });
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Handle data changes from tabs
  const handleDataChange = (key, newValue) => {
    setData(prev => ({
      ...prev,
      [key]: newValue
    }));
    setHasUnsavedChanges(true);
  };

  // Handle adding a new product
  const handleAddProduct = async (productName) => {
    setIsLoading(true);
    try {
      const result = await electronAPI.dasGeneralAddProduct(productName, filePath);
      if (result.success) {
        await loadData(); // Reload to get updated data
        return { success: true };
      } else {
        setError({
          type: result.error || 'ADD_ERROR',
          message: result.message || 'Failed to add product.',
          canDismiss: true
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      setError({
        type: 'ADD_ERROR',
        message: err.message,
        canDismiss: true
      });
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing a product
  const handleRemoveProduct = async (productName) => {
    setIsLoading(true);
    try {
      const result = await electronAPI.dasGeneralRemoveProduct(productName, filePath);
      if (result.success) {
        await loadData(); // Reload to get updated data
        return { success: true };
      } else {
        setError({
          type: result.error || 'REMOVE_ERROR',
          message: result.message || 'Failed to remove product.',
          canDismiss: true
        });
        return { success: false, error: result.message };
      }
    } catch (err) {
      setError({
        type: 'REMOVE_ERROR',
        message: err.message,
        canDismiss: true
      });
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'team-members',
      label: 'Team Members',
      icon: '👥',
      description: 'Team directory'
    },
    {
      id: 'training-material',
      label: 'Training Material',
      icon: '📚',
      description: 'Product training'
    },
    {
      id: 'products-info',
      label: 'Products Info',
      icon: '💡',
      description: 'Product details'
    }
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'team-members':
        return (
          <TeamMembersTab
            teamMembers={data.teamMembers}
            onDataChange={(newData) => handleDataChange('teamMembers', newData)}
            onSave={handleSaveAll}
            isLoading={isLoading}
          />
        );
      case 'training-material':
        return (
          <TrainingMaterialTab
            trainingMaterial={data.trainingMaterial}
            products={data.products}
            onDataChange={(newData) => handleDataChange('trainingMaterial', newData)}
            onSave={handleSaveAll}
            onAddProduct={handleAddProduct}
            onRemoveProduct={handleRemoveProduct}
            isLoading={isLoading}
          />
        );
      case 'products-info':
        return (
          <ProductsInfoTab
            productsInfo={data.productsInfo}
            products={data.products}
            onDataChange={(newData) => handleDataChange('productsInfo', newData)}
            onSave={handleSaveAll}
            onAddProduct={handleAddProduct}
            onRemoveProduct={handleRemoveProduct}
            isLoading={isLoading}
          />
        );
      default:
        return null;
    }
  };

  // Render error state
  if (error && !error.canDismiss) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">
            {error.type === 'FILE_NOT_FOUND' ? '📁' : 
             error.type === 'FILE_LOCKED' ? '🔒' : 
             error.type === 'NETWORK_ERROR' ? '🌐' : '⚠️'}
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error.type === 'FILE_NOT_FOUND' ? 'File Not Found' :
             error.type === 'FILE_LOCKED' ? 'File is Locked' :
             error.type === 'NETWORK_ERROR' ? 'Network Error' : 'Error Loading Data'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error.message}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {error.canCreate && (
              <button
                onClick={handleCreateFile}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Create New File
              </button>
            )}
            {error.canRetry && (
              <button
                onClick={loadData}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-left">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>File Path:</strong> {filePath}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              You can change this path in Settings → Advanced Settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              DAS General
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Team information, training materials, and product details
            </p>
          </div>
          <div className="flex items-center gap-4">
            {hasUnsavedChanges && (
              <span className="text-warning-600 dark:text-warning-400 text-sm font-medium flex items-center gap-1">
                <span className="w-2 h-2 bg-warning-500 rounded-full animate-pulse"></span>
                Unsaved changes
              </span>
            )}
            {lastSaved && (
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                Last saved: {new Date(lastSaved).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Refresh data from Excel file"
            >
              <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Error banner (dismissible) */}
      {error && error.canDismiss && (
        <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-danger-800 dark:text-danger-300">
                {error.type === 'SAVE_ERROR' ? 'Failed to Save' : 'Error'}
              </h3>
              <p className="text-danger-700 dark:text-danger-400 text-sm">
                {error.message}
              </p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-danger-600 dark:text-danger-400 hover:text-danger-800 dark:hover:text-danger-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-all
              ${activeTab === tab.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {isLoading && !data.teamMembers.length ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600 dark:text-gray-400">Loading data...</p>
            </div>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  );
}

export default DASGeneralPage;
