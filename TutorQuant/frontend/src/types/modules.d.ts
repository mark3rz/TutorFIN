/* Type declarations for modules without bundled types */

declare module "react-plotly.js" {
  import { Component } from "react";

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onHover?: (event: Plotly.PlotHoverEvent) => void;
    onClick?: (event: Plotly.PlotMouseEvent) => void;
    onSelected?: (event: Plotly.PlotSelectionEvent) => void;
    onRelayout?: (event: Plotly.PlotRelayoutEvent) => void;
  }

  export default class Plot extends Component<PlotParams> {}
}

declare module "katex" {
  interface KatexOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
    trust?: boolean;
    strict?: boolean | string | ((errorCode: string) => string);
    output?: "html" | "mathml" | "htmlAndMathml";
    macros?: Record<string, string>;
  }

  function render(
    tex: string,
    element: HTMLElement,
    options?: KatexOptions
  ): void;

  function renderToString(tex: string, options?: KatexOptions): string;

  const katex: { render: typeof render; renderToString: typeof renderToString };
  export default katex;
}
