import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('App Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
                        <div className="text-6xl mb-4">🚧</div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">
                            發生了一點問題
                        </h1>
                        <p className="text-gray-500 mb-6">
                            請重新載入頁面，或稍後再試。
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
                        >
                            重新載入
                        </button>
                        {this.state.error && (
                            <details className="mt-6 text-left text-xs text-gray-400">
                                <summary className="cursor-pointer">技術詳情</summary>
                                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
