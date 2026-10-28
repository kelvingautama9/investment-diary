import * as React from 'react';
import { Tooltip as RechartsTooltip } from 'recharts';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<string, string>;
  }
>;

interface ChartContainerProps extends React.ComponentProps<'div'> {
  config: ChartConfig;
  children: React.ReactElement;
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ id, className, children, config, ...props }, ref) => {
    // Generate CSS variables for chart colors based on config
    const styleVariables: Record<string, string> = {};
    if (config) {
      Object.entries(config).forEach(([key, item]) => {
        if (item.color) {
          styleVariables[`--color-${key}`] = item.color;
        }
      });
    }

    return (
      <div
        ref={ref}
        className={className}
        style={{ ...styleVariables, ...props.style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

export const ChartTooltip = RechartsTooltip;
