import React from 'react';
import { EngineStatusBanner } from './EngineStatusBanner.js';

interface WebDevBannerProps {
  engineConnected: boolean;
}

/** @deprecated Use EngineStatusBanner */
export const WebDevBanner: React.FC<WebDevBannerProps> = ({ engineConnected }) => (
  <EngineStatusBanner engineConnected={engineConnected} engineLoading={false} />
);
