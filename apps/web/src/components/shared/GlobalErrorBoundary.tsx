import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw, ChevronRight, ChevronDown, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error('Captured by GlobalErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev }));
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-violet-500 to-indigo-500" />
            
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-6 shadow-inner animate-pulse">
                <ShieldAlert size={32} />
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight text-slate-100 mb-2">
                Application Crash
              </h1>
              
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                An unexpected runtime exception has occurred. The system has safely halted execution to prevent data loss.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium h-11 px-4 rounded-xl border border-slate-700/50 transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
              >
                <RefreshCw size={16} className="text-slate-400 animate-spin-slow" />
                Reload Application
              </button>

              {this.state.error && (
                <div className="border border-slate-800/60 bg-slate-950/40 rounded-xl overflow-hidden">
                  <button
                    onClick={this.toggleDetails}
                    className="w-full flex items-center justify-between p-3.5 text-xs text-slate-400 hover:text-slate-300 font-mono transition-colors"
                  >
                    <span className="flex items-center gap-2 font-medium uppercase tracking-wider">
                      <Terminal size={13} />
                      Error Details
                    </span>
                    {this.state.showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {this.state.showDetails && (
                    <div className="p-4 border-t border-slate-800/40 bg-slate-950 font-mono text-[11px] text-slate-300 overflow-auto max-h-60 leading-relaxed scrollbar-thin">
                      <p className="font-bold text-rose-400 mb-2 break-words">
                        {this.state.error.name}: {this.state.error.message}
                      </p>
                      {this.state.errorInfo?.componentStack && (
                        <pre className="text-slate-500 whitespace-pre-wrap select-all">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default GlobalErrorBoundary;
