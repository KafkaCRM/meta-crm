import { apiCall } from '@/lib/api';

export interface FranchiseStatus {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_type: 'franchisor' | 'franchisee' | 'independent';
  is_franchisor: boolean;
  is_franchisee: boolean;
  parent_franchisor?: {
    id: string;
    name: string;
    slug: string;
    industry: string;
  } | null;
  royalty_percentage: number | null;
  territory_codes: string[];
  franchisee_count: number;
}

export interface FranchiseeSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  royalty_percentage: number;
  territory_codes: string[];
  branch_count: number;
  user_count: number;
  branches: { id: string; name: string; city: string | null }[];
  created_at: string;
}

export const franchiseApi = {
  getStatus: () => apiCall<FranchiseStatus>('/franchise/status'),
  getFranchisees: () => apiCall<FranchiseeSummary[]>('/franchise/franchisees'),
  getAnalytics: () => apiCall<any>('/franchise/analytics'),
};
