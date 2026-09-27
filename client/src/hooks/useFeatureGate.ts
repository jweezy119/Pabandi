import { useBusinessSettings } from './useBusinessSettings';

export function useFeatureGate() {
  const { settings } = useBusinessSettings();
  
  return {
    hasModule: (moduleId: string) => settings.enabledModules.includes(moduleId),
    hasFeature: (moduleId: string, featureId: string) => {
      const features = settings.enabledFeatures[moduleId] || [];
      return features.includes(featureId);
    },
    isEnabled: (path: string) => {
      // Basic check implementation based on routes
      // Can be expanded as needed
      return true;
    },
  };
}
