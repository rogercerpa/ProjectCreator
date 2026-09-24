import React, { useCallback, useEffect, useState } from 'react';
import ProductsInfoTab from '../dasgeneral/ProductsInfoTab';

const { electronAPI } = window;

export default function ProductsInfoHost() {
  const [filePath, setFilePath] = useState('');
  const [productsInfo, setProductsInfo] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const settingsResult = await electronAPI.dasGeneralGetSettings();
      const path = settingsResult?.settings?.filePath || '';
      setFilePath(path);
      const loaded = await electronAPI.dasGeneralLoadAll(path || undefined);
      if (!loaded?.success) {
        setError(loaded?.message || 'The DAS General workbook could not be opened.');
        return;
      }
      setProductsInfo(Array.isArray(loaded.data?.productsInfo) ? loaded.data.productsInfo : []);
      setProducts(Array.isArray(loaded.data?.products) ? loaded.data.products : []);
    } catch (err) {
      setError(err.message || 'The DAS General workbook could not be opened.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (partial) => {
    const loaded = await electronAPI.dasGeneralLoadAll(filePath || undefined);
    if (!loaded?.success) {
      return { success: false, error: loaded?.message || 'Could not read the workbook before saving.' };
    }
    const next = {
      teamMembers: loaded.data?.teamMembers || [],
      trainingMaterial: loaded.data?.trainingMaterial || [],
      productsInfo: partial.productsInfo ?? loaded.data?.productsInfo ?? [],
      products: loaded.data?.products || [],
      machineUsers: loaded.data?.machineUsers || [],
      activityAction: 'Saved products'
    };
    const result = await electronAPI.dasGeneralSaveAll(next, filePath || undefined);
    if (result?.success) {
      setProductsInfo(next.productsInfo);
      setProducts(next.products);
    }
    return result;
  };

  const handleAddProduct = async (productName) => {
    const result = await electronAPI.dasGeneralAddProduct(productName, filePath || undefined);
    if (result?.success) await load();
    return result?.success ? { success: true } : { success: false, error: result?.message };
  };

  const handleRemoveProduct = async (productName) => {
    const result = await electronAPI.dasGeneralRemoveProduct(productName, filePath || undefined);
    if (result?.success) await load();
    return result?.success ? { success: true } : { success: false, error: result?.message };
  };

  if (error) {
    return (
      <div className="p-6 text-sm text-gray-700 dark:text-gray-200">
        <p>{error}</p>
        <p className="mt-2 text-gray-500">Product details stay in the DAS General workbook. Check the file path under Settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ProductsInfoTab
        productsInfo={productsInfo}
        products={products}
        onDataChange={setProductsInfo}
        onSave={handleSave}
        onAddProduct={handleAddProduct}
        onRemoveProduct={handleRemoveProduct}
        isLoading={isLoading}
      />
    </div>
  );
}
