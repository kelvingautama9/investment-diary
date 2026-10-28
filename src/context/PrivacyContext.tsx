import React, { createContext, useContext, useState, useEffect } from 'react';

interface PrivacyContextType {
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  setPrivacyMode: (value: boolean) => void;
  formatPrivacyIdr: (amount: number, hidePrefix?: boolean) => string;
  formatPrivacyUsd: (amount: number) => string;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivacyMode, setIsPrivacyModeState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('investment_diary_privacy');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('investment_diary_privacy', String(isPrivacyMode));
  }, [isPrivacyMode]);

  const togglePrivacyMode = () => {
    setIsPrivacyModeState(prev => !prev);
  };

  const setPrivacyMode = (value: boolean) => {
    setIsPrivacyModeState(value);
  };

  const formatPrivacyIdr = (amount: number, hidePrefix = false): string => {
    if (isPrivacyMode) {
      return hidePrefix ? '••••••••' : 'Rp ••••••••';
    }
    const rounded = Math.round(amount);
    const formatted = rounded.toLocaleString('id-ID');
    return hidePrefix ? formatted : `Rp ${formatted}`;
  };

  const formatPrivacyUsd = (amount: number): string => {
    if (isPrivacyMode) {
      return '$••••••';
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
  };

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        togglePrivacyMode,
        setPrivacyMode,
        formatPrivacyIdr,
        formatPrivacyUsd,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
