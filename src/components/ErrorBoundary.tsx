import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Mensagens já resolvidas pelo App (evita hooks no fallback). */
  message: string;
  reloadLabel: string;
}

interface State {
  error: Error | null;
}

/** Evita tela preta no iOS/Safari quando um render explode: mostra recovery. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            font: '400 13px/1.5 var(--mono)',
            color: 'var(--ink-muted)',
            maxWidth: 320,
          }}
        >
          {this.props.message}
        </p>
        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          {this.props.reloadLabel}
        </button>
        {/* Detalhe técnico pra diagnóstico em campo (mobile sem console) */}
        <code
          style={{
            font: '400 10px/1.5 var(--mono)',
            color: 'var(--ink-faint)',
            maxWidth: 340,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {this.state.error.name}: {this.state.error.message}
          {'\n'}
          {(this.state.error.stack ?? '')
            .split('\n')
            .slice(1, 4)
            .join('\n')}
        </code>
      </div>
    );
  }
}
