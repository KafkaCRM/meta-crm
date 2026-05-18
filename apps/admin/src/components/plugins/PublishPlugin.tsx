import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPlugin } from '@/api/platform';

const PluginManifestSchema = z.object({
  id: z.string().min(1, 'Manifest id is required'),
  name: z.string().min(1, 'Manifest name is required'),
  description: z.string().min(1, 'Manifest description is required'),
  compatible_industries: z
    .array(z.string())
    .min(1, 'At least one compatible industry required'),
  hooks: z.array(z.string()).optional().default([]),
  extends: z.array(z.string()).optional().default([]),
});

const defaultManifest = `{
  "id": "plugin-example",
  "name": "Example Plugin",
  "description": "An example plugin",
  "compatible_industries": ["healthcare"],
  "hooks": ["case:stage_changed"],
  "extends": ["Case"]
}`;

export function PublishPlugin() {
  const [packageName, setPackageName] = useState('');
  const [version, setVersion] = useState('');
  const [manifestJson, setManifestJson] = useState(defaultManifest);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const validation = useMemo(() => {
    try {
      const parsed = JSON.parse(manifestJson);
      const result = PluginManifestSchema.safeParse(parsed);
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        return { valid: false, errors: fieldErrors, parseError: null };
      }
      return { valid: true, errors: {}, parseError: null };
    } catch (e: any) {
      return { valid: false, errors: {}, parseError: e.message };
    }
  }, [manifestJson]);

  const createMutation = useMutation({
    mutationFn: () =>
      createPlugin({
        package_name: packageName,
        version,
        manifest: JSON.parse(manifestJson),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setPackageName('');
      setVersion('');
      setManifestJson(defaultManifest);
      setError('');
    },
    onError: (err: any) => {
      setError(err.message ?? 'Failed to create plugin');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) return;
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Plugin Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="packageName" className="mb-1 block text-sm font-medium">
                Package Name
              </label>
              <input
                id="packageName"
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="@meta-crm/plugin-example"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="version" className="mb-1 block text-sm font-medium">
                Version
              </label>
              <input
                id="version"
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h3 className="mb-4 text-lg font-semibold">Manifest JSON</h3>
          <textarea
            value={manifestJson}
            onChange={(e) => setManifestJson(e.target.value)}
            rows={12}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
          />

          <div className="mt-4 space-y-2">
            {validation.parseError && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                <p className="font-medium">JSON Parse Error:</p>
                <p className="font-mono">{validation.parseError}</p>
              </div>
            )}

            {validation.valid && !validation.parseError && (
              <div className="rounded bg-green-50 p-3 text-sm text-green-700">
                Manifest is valid
              </div>
            )}

            {!validation.valid && !validation.parseError && Object.keys(validation.errors).length > 0 && (
              <div className="rounded bg-red-50 p-3 text-sm text-red-700">
                <p className="mb-2 font-medium">Validation Errors:</p>
                <ul className="list-inside list-disc space-y-1">
                  {Object.entries(validation.errors).map(([field, messages]) => (
                    <li key={field}>
                      <span className="font-medium">{field}:</span>{' '}
                      {(messages as string[]).join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!validation.valid || createMutation.isPending}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Registering...' : 'Register Plugin'}
        </button>
      </form>
    </div>
  );
}
