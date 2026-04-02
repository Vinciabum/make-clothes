import React from 'react';

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
  currentStep: string;
}

export enum EditMode {
  OUTFIT = 'OUTFIT',
  HAIR = 'HAIR',
  RETOUCH = 'RETOUCH'
}

export interface PresetOption {
  id: string;
  label: string;
  prompt: string;
  thumbnailUrl?: string;
  category?: string;
  icon?: React.ReactNode;
}