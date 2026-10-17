import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook up your logging service here (Sentry, etc.)
    console.error('Uncaught error:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ? (
        this.props.fallback({ error, reset: this.reset })
      ) : (
        <ErrorFallback error={error} reset={this.reset} />
      );
    }
    return this.props.children;
  }
}

export function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred. You can try again or go back to the home page.</p>
      {import.meta.env.DEV && (
        <pre style={{ maxWidth: 600, overflow: 'auto', color: '#b00020' }}>
          {error.message}
        </pre>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={reset}>Try again</button>
        <button onClick={() => (window.location.href = '/')}>Go to home</button>
      </div>
    </div>
  );
}