import React, { useEffect, useRef } from 'react';
import type { Timeframe } from '../types';
import { SUPPORTED_SYMBOLS } from '../services/marketData';

interface TradingViewWidgetProps {
  symbol: string;
  timeframe: Timeframe;
  isLogarithmic: boolean;
}

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({
  symbol,
  timeframe,
  isLogarithmic,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert timeframe to TradingView interval string
  const getTvInterval = (tf: Timeframe): string => {
    switch (tf) {
      case '1M': return '1';
      case '5M': return '5';
      case '15M': return '15';
      case '30M': return '30';
      case '1H': return '60';
      case '4H': return '240';
      case '1D': return 'D';
      case '1W': return 'W';
      default: return '60';
    }
  };

  const currentMeta = SUPPORTED_SYMBOLS.find(s => s.symbol === symbol) || SUPPORTED_SYMBOLS[0];
  const tvSymbol = currentMeta.tradingViewSymbol;

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const widgetConfig = {
      autosize: true,
      symbol: tvSymbol,
      interval: getTvInterval(timeframe),
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1', // Candlesticks
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      backgroundColor: 'rgba(8, 11, 17, 1)',
      gridColor: 'rgba(30, 41, 59, 0.35)',
      scalesProperties: {
        mode: isLogarithmic ? 1 : 0, // 1 = Logarithmic scale, 0 = Normal/Linear scale
      },
      support_host: 'https://www.tradingview.com',
    };

    script.innerHTML = JSON.stringify(widgetConfig);

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    containerRef.current.appendChild(widgetContainer);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, timeframe, isLogarithmic]);

  return (
    <div className="relative w-full h-[520px] bg-[#080b11] rounded border border-[#1e293b] overflow-hidden">
      <div ref={containerRef} className="tradingview-widget-container w-full h-full" />
    </div>
  );
};
