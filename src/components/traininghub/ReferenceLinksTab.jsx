import React, { useCallback, useEffect, useState } from 'react';
import TrainingMaterialTab from '../dasgeneral/TrainingMaterialTab';

const { electronAPI } = window;

export default function ReferenceLinksTab() {
  const [filePath, setFilePath] = useState('');
  const [trainingMaterial, setTrainingMaterial] = useState([]);
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
      setTrainingMaterial(Array.isArray(loaded.data?.trainingMaterial) ? loaded.data.trainingMaterial : []);
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
      trainingMaterial: partial.trainingMaterial ?? loaded.data?.trainingMaterial ?? [],
      productsInfo: loaded.data?.productsInfo || [],
      products: loaded.data?.products || []
    };
    return electronAPI.dasGeneralSaveAll(next, filePath || undefined);
  };

  if (error) {
    return (
      <div className="p-6 text-sm text-gray-700 dark:text-gray-200">
        <p>{error}</p>
        <p className="mt-2 text-gray-500">Reference links stay in the DAS General workbook. Check the file path under Settings.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <TrainingMaterialTab
        trainingMaterial={trainingMaterial}
        products={products}
        onDataChange={setTrainingMaterial}
        onSave={handleSave}
        isLoading={isLoading}
        allowProductAdmin={false}
        title="Reference links"
        subtitle="Product training links from the DAS General workbook. Add products on DAS General → Products Info."
      />
    </div>
  );
}
