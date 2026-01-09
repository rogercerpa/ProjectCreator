import React, { useState } from 'react';

const { electronAPI } = window;

function TrainingMaterialTab({ 
  trainingMaterial = [], 
  products = [], 
  onDataChange, 
  onSave, 
  onAddProduct, 
  onRemoveProduct,
  isLoading 
}) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saveStatus, setSaveStatus] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  // Ensure arrays are valid
  const safeTrainingMaterial = Array.isArray(trainingMaterial) ? trainingMaterial : [];
  const safeProducts = Array.isArray(products) ? products : [];

  // Filter training material by selected product
  const filteredMaterial = selectedProduct === 'all' 
    ? safeTrainingMaterial 
    : safeTrainingMaterial.filter(t => t.product === selectedProduct);

  // Group training material by product for display
  const materialByProduct = {};
  safeProducts.forEach(product => {
    materialByProduct[product] = safeTrainingMaterial.filter(t => t.product === product);
  });

  // Handle starting edit
  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Handle saving edit
  const handleSaveEdit = async () => {
    if (!editForm.product?.trim()) {
      alert('Product is required');
      return;
    }

    setSaveStatus('saving');
    const updatedMaterial = safeTrainingMaterial.map(t =>
      t.id === editingId ? { ...editForm } : t
    );

    const result = await onSave({ trainingMaterial: updatedMaterial });
    
    if (result.success) {
      onDataChange(updatedMaterial);
      setEditingId(null);
      setEditForm({});
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle adding new training material entry
  const handleAddEntry = async (product) => {
    setSaveStatus('saving');
    const newId = `trainingmaterial-${Date.now()}`;
    const newEntry = {
      id: newId,
      product: product,
      linkType: 'URL',
      link: '',
      description: ''
    };

    const updatedMaterial = [...safeTrainingMaterial, newEntry];
    const result = await onSave({ trainingMaterial: updatedMaterial });

    if (result.success) {
      onDataChange(updatedMaterial);
      // Start editing the new entry
      handleEdit(newEntry);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle deleting entry
  const handleDelete = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this training material entry?')) {
      return;
    }

    setSaveStatus('saving');
    const updatedMaterial = safeTrainingMaterial.filter(t => t.id !== itemId);
    const result = await onSave({ trainingMaterial: updatedMaterial });

    if (result.success) {
      onDataChange(updatedMaterial);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2000);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Handle adding new product
  const handleAddProductSubmit = async () => {
    if (!newProductName.trim()) {
      alert('Product name is required');
      return;
    }

    const result = await onAddProduct(newProductName.trim());
    if (result.success) {
      setNewProductName('');
      setShowAddProduct(false);
    }
  };

  // Handle opening link
  const handleOpenLink = (link, linkType) => {
    if (!link) return;
    
    if (linkType === 'URL') {
      electronAPI.openExternal(link);
    } else {
      // For file paths, try to open in explorer/finder
      electronAPI.openExternal(`file://${link}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Training Material
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Training resources and links by product
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          {saveStatus && (
            <span className={`text-sm font-medium ${
              saveStatus === 'saving' ? 'text-gray-500' :
              saveStatus === 'saved' ? 'text-success-600 dark:text-success-400' :
              'text-danger-600 dark:text-danger-400'
            }`}>
              {saveStatus === 'saving' ? '💾 Saving...' :
               saveStatus === 'saved' ? '✅ Saved!' :
               '❌ Save failed'}
            </span>
          )}
          
          {/* Product filter */}
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Products</option>
            {safeProducts.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>

          {/* Add product button */}
          <button
            onClick={() => setShowAddProduct(true)}
            disabled={isLoading}
            className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <span>🏷️</span>
            Add Product
          </button>
        </div>
      </div>

      {/* Add new product dialog */}
      {showAddProduct && (
        <div className="p-6 bg-secondary-50 dark:bg-secondary-900/20 border border-secondary-200 dark:border-secondary-800 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add New Product
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder="Product name"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-secondary-500"
            />
            <button
              onClick={handleAddProductSubmit}
              disabled={isLoading || !newProductName.trim()}
              className="px-4 py-2 bg-secondary-600 hover:bg-secondary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddProduct(false);
                setNewProductName('');
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Training material by product */}
      {selectedProduct === 'all' ? (
        // Show all products grouped
        <div className="space-y-6">
          {safeProducts.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Products Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add a product to start adding training materials.
              </p>
            </div>
          ) : (
            safeProducts.map(product => (
              <ProductSection
                key={product}
                product={product}
                items={materialByProduct[product] || []}
                editingId={editingId}
                editForm={editForm}
                onEdit={handleEdit}
                onCancelEdit={handleCancelEdit}
                onSaveEdit={handleSaveEdit}
                setEditForm={setEditForm}
                onAddEntry={() => handleAddEntry(product)}
                onDelete={handleDelete}
                onOpenLink={handleOpenLink}
                isLoading={isLoading}
              />
            ))
          )}
        </div>
      ) : (
        // Show single product
        <ProductSection
          product={selectedProduct}
          items={filteredMaterial}
          editingId={editingId}
          editForm={editForm}
          onEdit={handleEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          setEditForm={setEditForm}
          onAddEntry={() => handleAddEntry(selectedProduct)}
          onDelete={handleDelete}
          onOpenLink={handleOpenLink}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

// Product section component
function ProductSection({ 
  product, 
  items, 
  editingId, 
  editForm, 
  onEdit, 
  onCancelEdit, 
  onSaveEdit, 
  setEditForm,
  onAddEntry,
  onDelete,
  onOpenLink,
  isLoading 
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Product header */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{product}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {items.length} training resource{items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={onAddEntry}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 rounded-lg transition-colors disabled:opacity-50"
        >
          ➕ Add Link
        </button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No training materials added yet. Click "Add Link" to add one.
        </div>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              {editingId === item.id ? (
                // Edit mode
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Link Type
                      </label>
                      <select
                        value={editForm.linkType || 'URL'}
                        onChange={(e) => setEditForm(prev => ({ ...prev, linkType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="URL">URL</option>
                        <option value="FilePath">File Path</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {editForm.linkType === 'FilePath' ? 'File Path' : 'URL'}
                      </label>
                      <input
                        type="text"
                        value={editForm.link || ''}
                        onChange={(e) => setEditForm(prev => ({ ...prev, link: e.target.value }))}
                        placeholder={editForm.linkType === 'FilePath' ? 'Z:\\path\\to\\file.pdf' : 'https://example.com'}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the training material"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={onCancelEdit}
                      className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onSaveEdit}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-success-600 hover:bg-success-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        item.linkType === 'FilePath' 
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {item.linkType === 'FilePath' ? '📁 File' : '🔗 URL'}
                      </span>
                    </div>
                    {item.link ? (
                      <button
                        onClick={() => onOpenLink(item.link, item.linkType)}
                        className="text-primary-600 dark:text-primary-400 hover:underline text-sm truncate block max-w-full text-left"
                        title={item.link}
                      >
                        {item.link}
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm italic">No link added</span>
                    )}
                    {item.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      disabled={isLoading}
                      className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      disabled={isLoading}
                      className="p-2 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/30 rounded transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrainingMaterialTab;
