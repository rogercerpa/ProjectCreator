import React, { useState, useEffect } from 'react';

function AgencyProductFocusTab({ agency }) {
  const [productFocus, setProductFocus] = useState([]);
  const [communicationPreferences, setCommunicationPreferences] = useState({
    preferredMethod: 'email',
    preferredTime: '',
    updateFrequency: 'weekly',
    notes: ''
  });
  const [updateHistory, setUpdateHistory] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    notes: ''
  });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (agency) {
      loadProductFocus();
      loadCommunicationPreferences();
      loadUpdateHistory();
    }
  }, [agency]);

  const loadProductFocus = async () => {
    // TODO: Load from extended agency data
    const products = agency?.productFocus || [];
    setProductFocus(products);
  };

  const loadCommunicationPreferences = async () => {
    // TODO: Load from extended agency data
    const prefs = agency?.preferences?.communication || {};
    setCommunicationPreferences({
      preferredMethod: prefs.preferredMethod || 'email',
      preferredTime: prefs.preferredTime || '',
      updateFrequency: prefs.updateFrequency || 'weekly',
      notes: prefs.notes || ''
    });
  };

  const loadUpdateHistory = async () => {
    // TODO: Load from extended agency data
    const history = agency?.productFocus?.flatMap(p => p.updateHistory || []) || [];
    setUpdateHistory(history.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const product = {
      id: `product-${Date.now()}`,
      ...newProduct,
      createdAt: new Date().toISOString()
    };

    const updatedProducts = [...productFocus, product];
    setProductFocus(updatedProducts);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        productFocus: updatedProducts
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Failed to save product: ' + error.message);
      setProductFocus(productFocus);
      return;
    }

    setNewProduct({ name: '', category: '', notes: '' });
    setShowAddProduct(false);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to remove this product?')) return;
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    const updatedProducts = productFocus.filter(p => p.id !== productId);
    setProductFocus(updatedProducts);

    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        productFocus: updatedProducts
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product: ' + error.message);
      setProductFocus(productFocus);
    }
  };

  const handleSavePreferences = async () => {
    if (!agency?.id) {
      alert('Agency ID is required to save data.');
      return;
    }

    setSaving(true);
    try {
      const result = await window.electronAPI.agenciesUpdate(agency.id, {
        preferences: {
          ...agency.preferences,
          communication: communicationPreferences
        }
      });

      if (result.success) {
        alert('Communication preferences saved successfully!');
      } else {
        throw new Error(result.error || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Focus Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Product Focus</h2>
          <button
            onClick={() => setShowAddProduct(!showAddProduct)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Product</span>
          </button>
        </div>

        {showAddProduct && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder="Enter product name..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  placeholder="Product category..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={newProduct.notes}
                  onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                  placeholder="Additional notes about this product..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows="3"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddProduct}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-all"
                >
                  Add Product
                </button>
                <button
                  onClick={() => {
                    setNewProduct({ name: '', category: '', notes: '' });
                    setShowAddProduct(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {productFocus.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No products tracked yet. Click "Add Product" to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {productFocus.map(product => (
              <div
                key={product.id}
                className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{product.name}</h3>
                    {product.category && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{product.category}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    title="Remove product"
                  >
                    ✕
                  </button>
                </div>
                {product.notes && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{product.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Communication Preferences Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Communication Preferences</h2>
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save</span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Communication Method
              </label>
              <select
                value={communicationPreferences.preferredMethod}
                onChange={(e) => setCommunicationPreferences({ ...communicationPreferences, preferredMethod: e.target.value })}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="meeting">In-Person Meeting</option>
                <option value="video">Video Call</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preferred Time
              </label>
              <input
                type="text"
                value={communicationPreferences.preferredTime}
                onChange={(e) => setCommunicationPreferences({ ...communicationPreferences, preferredTime: e.target.value })}
                placeholder="e.g., Morning, Afternoon, 9-5 EST"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Update Frequency
            </label>
            <select
              value={communicationPreferences.updateFrequency}
              onChange={(e) => setCommunicationPreferences({ ...communicationPreferences, updateFrequency: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="as-needed">As Needed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes
            </label>
            <textarea
              value={communicationPreferences.notes}
              onChange={(e) => setCommunicationPreferences({ ...communicationPreferences, notes: e.target.value })}
              placeholder="Any additional communication preferences or notes..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows="3"
            />
          </div>
        </div>
      </div>

      {/* Update History Section */}
      {updateHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Product Update History</h2>
          <div className="space-y-3">
            {updateHistory.slice(0, 10).map((update, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{update.title || 'Product Update'}</p>
                    {update.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{update.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(update.date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AgencyProductFocusTab;

