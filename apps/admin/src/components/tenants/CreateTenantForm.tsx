import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createTenant, CreateTenantResponse, listPlans } from '@/api/platform';

const INDUSTRIES = ['education', 'healthcare', 'real-estate', 'retail', 'finance', 'technology'];

export function CreateTenantForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [industry, setIndustry] = useState('');
  const [planId, setPlanId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreateTenantResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: listPlans,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await createTenant({
        name,
        slug,
        industry,
        plan_id: planId,
        owner: {
          name: ownerName,
          email: ownerEmail,
        },
      });
      setResult(response);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-bold text-green-600">Tenant Created Successfully</h2>
        <div className="space-y-3 rounded bg-gray-50 p-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Tenant Name:</span>
            <p className="text-gray-900">{result.tenant.name}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Slug:</span>
            <p className="text-gray-900">{result.tenant.slug}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Industry:</span>
            <p className="text-gray-900">{result.tenant.industry}</p>
          </div>
          <div className="border-t pt-3">
            <span className="text-sm font-medium text-gray-500">Owner Email:</span>
            <p className="text-gray-900">{result.owner.email}</p>
          </div>
          <div className="rounded border border-yellow-200 bg-yellow-50 p-3">
            <span className="text-sm font-medium text-yellow-800">Temporary Password (shown once):</span>
            <p className="font-mono text-lg text-yellow-900">{result.owner.temporary_password}</p>
            <p className="mt-1 text-xs text-yellow-700">
              Save this password — it will not be shown again.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setResult(null);
            setName('');
            setSlug('');
            setIndustry('');
            setPlanId('');
            setOwnerName('');
            setOwnerEmail('');
          }}
          className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Create Another Tenant
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-6 text-xl font-bold">Create New Tenant</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Tenant Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="slug" className="mb-1 block text-sm font-medium">
            Slug (used in login URL)
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
        </div>
        <div>
          <label htmlFor="industry" className="mb-1 block text-sm font-medium">
            Industry
          </label>
          <select
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="plan" className="mb-1 block text-sm font-medium">
            Subscription Plan
          </label>
          <select
            id="plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          >
            <option value="">Select plan...</option>
            {plans?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} — {plan.max_branches} branches, {plan.max_users} users
              </option>
            ))}
          </select>
        </div>
        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-semibold">Owner Details</h3>
          <div className="space-y-3">
            <div>
              <label htmlFor="ownerName" className="mb-1 block text-sm font-medium">
                Owner Name
              </label>
              <input
                id="ownerName"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
            </div>
            <div>
              <label htmlFor="ownerEmail" className="mb-1 block text-sm font-medium">
                Owner Email
              </label>
              <input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                required
              />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}
