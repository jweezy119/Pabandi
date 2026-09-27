import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './primitives/Button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-[var(--atmosphere)] rounded-3xl m-4 border border-[rgba(191,179,163,0.2)]">
          <div className="w-16 h-16 rounded-2xl bg-[rgba(201,123,90,0.1)] text-[var(--terracotta)] flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[32px]">error</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2 font-headline">Something went wrong</h2>
          <p className="text-[var(--soft-stone)] max-w-md mb-8">
            {this.state.error?.message || "An unexpected error occurred while loading this page."}
          </p>
          <Button 
            variant="primary" 
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Reload Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
