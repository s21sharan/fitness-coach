"use client";

import { useState } from "react";

interface ApiKeyModalProps {
  provider: string;
  title: string;
  helpUrl?: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => Promise<void>;
}

export function ApiKeyModal({ provider, title, helpUrl, open, onClose, onSubmit }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(apiKey);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h3 className="text-lg font-semibold">Connect {title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Requires Hevy Pro.{" "}
          {helpUrl && (
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              How to get your API key
            </a>
          )}
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor={`${provider}-key`} className="block text-sm font-medium text-gray-700">
              API Key
            </label>
            <input
              id={`${provider}-key`}
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="Enter your API key"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
