import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. Please try refreshing the page.
            </p>
          </div>
          {this.state.error && (
            <pre className="text-xs text-left bg-muted rounded-lg p-3 overflow-auto max-h-32 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Refresh Page
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/dashboard';
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
