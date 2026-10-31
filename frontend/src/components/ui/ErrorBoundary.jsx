import React from 'react';
import { AlertOctagon, RotateCw, Home } from 'lucide-react';
import Button from './Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white border-2 border-ink rounded-[4px] shadow-neo-lg text-center">
          <div className="w-16 h-16 rounded-[4px] border-2 border-ink bg-brand-danger text-white flex items-center justify-center mx-auto mb-4 shadow-neo-sm">
            <AlertOctagon size={32} />
          </div>
          <h2 className="font-anton text-2xl uppercase tracking-wider text-ink mb-2">
            Something Went Wrong
          </h2>
          <p className="text-sm font-medium text-ink-muted mb-4">
            An unexpected error occurred while rendering this view.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-cream border-2 border-ink/40 rounded-[4px] text-xs font-mono text-left mb-6 overflow-x-auto text-ink">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={this.handleReset}>
              <RotateCw size={14} className="mr-2" />
              Reload View
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
            >
              <Home size={14} className="mr-2" />
              Return Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
