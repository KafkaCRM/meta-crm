import { apiCall } from '@/lib/api';

// --- APPOINTMENTS CAPABILITY ---
export interface Appointment {
  id: string;
  tenant_id: string;
  party_id: string;
  user_id?: string | null;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  room?: string | null;
  status: string;
  created_at: string;
  party?: {
    id: string;
    name: string;
    email?: string | null;
    phone_normalized?: string | null;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  available: boolean;
}

export interface CreateAppointmentInput {
  party_id: string;
  user_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  room?: string;
}

export interface UpdateAppointmentInput {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
  status?: string;
}

export interface ListAppointmentsParams {
  party_id?: string;
  user_id?: string;
  start?: string;
  end?: string;
}

// --- BILLING CAPABILITY ---
export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  reference?: string | null;
  payment_date: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  party_id: string;
  amount: number;
  status: 'sent' | 'paid' | 'void' | string;
  issue_date: string;
  due_date: string;
  billing_details: any;
  created_at: string;
  party?: {
    id: string;
    name: string;
    email?: string | null;
  };
  items?: InvoiceLineItem[];
  payments?: Payment[];
}

export interface BillingStats {
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  overdue_count: number;
  invoice_count: number;
}

export interface CreateInvoiceInput {
  party_id: string;
  due_date: string;
  billing_details?: any;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface RegisterPaymentInput {
  amount: number;
  method: string;
  reference?: string;
  payment_date?: string;
}

// --- PROPERTIES CAPABILITY ---
export interface Property {
  id: string;
  tenant_id: string;
  title: string;
  description?: string | null;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  latitude?: number | null;
  longitude?: number | null;
  status: 'available' | 'sold' | 'pending' | string;
  images: string[];
  created_at: string;
}

export interface CreatePropertyInput {
  title: string;
  description?: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  images?: string[];
}

export interface UpdatePropertyInput {
  title?: string;
  description?: string;
  address?: string;
  city?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  images?: string[];
}

export interface ListPropertiesParams {
  city?: string;
  status?: string;
  min_price?: number;
  max_price?: number;
  bedrooms?: number;
}

// --- ORDER MANAGEMENT CAPABILITY ---
export interface OrderLineItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Order {
  id: string;
  tenant_id: string;
  party_id: string;
  total_amount: number;
  status: string;
  payment_method?: string | null;
  payment_status: string;
  created_at: string;
  party?: {
    id: string;
    name: string;
    email?: string | null;
    phone_normalized?: string | null;
  };
  items?: OrderLineItem[];
}

export interface CreateOrderInput {
  party_id: string;
  total_amount: number;
  payment_method?: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface UpdateOrderInput {
  status?: string;
  payment_status?: string;
  payment_method?: string;
}

export interface ListOrdersParams {
  party_id?: string;
  status?: string;
}

// --- CUSTOMER ONBOARDING CAPABILITY ---
export interface OnboardingStep {
  id: string;
  title: string;
  completed: boolean;
  completed_at?: string | null;
  order: number;
}

export interface Onboarding {
  id: string;
  tenant_id: string;
  party_id: string;
  status: string;
  contract_value?: number | null;
  setup_completed: boolean;
  created_at: string;
  party?: {
    id: string;
    name: string;
    email?: string | null;
    phone_normalized?: string | null;
  };
  steps?: OnboardingStep[];
}

export interface CreateOnboardingInput {
  party_id: string;
  contract_value?: number;
  steps?: { title: string; order: number }[];
}

export interface UpdateOnboardingInput {
  status?: string;
  contract_value?: number;
}

export interface ListOnboardingsParams {
  party_id?: string;
  status?: string;
}

// --- API DEFINITION ---
export const capabilitiesApi = {
  appointments: {
    list: (params: ListAppointmentsParams = {}) => {
      const qs = new URLSearchParams();
      if (params.party_id) qs.set('party_id', params.party_id);
      if (params.user_id) qs.set('user_id', params.user_id);
      if (params.start) qs.set('start', params.start);
      if (params.end) qs.set('end', params.end);
      const query = qs.toString();
      return apiCall<Appointment[]>(`/appointments${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<Appointment>(`/appointments/${id}`),
    create: (data: CreateAppointmentInput) =>
      apiCall<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateAppointmentInput) =>
      apiCall<Appointment>(`/appointments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getSlots: (date: string, userId?: string) => {
      const qs = new URLSearchParams();
      qs.set('date', date);
      if (userId) qs.set('user_id', userId);
      return apiCall<AvailableSlot[]>(`/appointments/slots?${qs.toString()}`);
    },
  },

  billing: {
    list: (params: { party_id?: string; status?: string } = {}) => {
      const qs = new URLSearchParams();
      if (params.party_id) qs.set('party_id', params.party_id);
      if (params.status) qs.set('status', params.status);
      const query = qs.toString();
      return apiCall<Invoice[]>(`/invoices${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<Invoice>(`/invoices/${id}`),
    create: (data: CreateInvoiceInput) =>
      apiCall<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    registerPayment: (id: string, data: RegisterPaymentInput) =>
      apiCall<{ payment: Payment; invoice: Invoice }>(`/invoices/${id}/payments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getStats: () => apiCall<BillingStats>('/invoices/stats'),
  },

  properties: {
    list: (params: ListPropertiesParams = {}) => {
      const qs = new URLSearchParams();
      if (params.city) qs.set('city', params.city);
      if (params.status) qs.set('status', params.status);
      if (params.min_price) qs.set('min_price', String(params.min_price));
      if (params.max_price) qs.set('max_price', String(params.max_price));
      if (params.bedrooms) qs.set('bedrooms', String(params.bedrooms));
      const query = qs.toString();
      return apiCall<Property[]>(`/properties${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<Property>(`/properties/${id}`),
    create: (data: CreatePropertyInput) =>
      apiCall<Property>('/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdatePropertyInput) =>
      apiCall<Property>(`/properties/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiCall<void>(`/properties/${id}`, {
        method: 'DELETE',
      }),
  },

  orders: {
    list: (params: ListOrdersParams = {}) => {
      const qs = new URLSearchParams();
      if (params.party_id) qs.set('party_id', params.party_id);
      if (params.status) qs.set('status', params.status);
      const query = qs.toString();
      return apiCall<Order[]>(`/orders${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<Order>(`/orders/${id}`),
    create: (data: CreateOrderInput) =>
      apiCall<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateOrderInput) =>
      apiCall<Order>(`/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  onboardings: {
    list: (params: ListOnboardingsParams = {}) => {
      const qs = new URLSearchParams();
      if (params.party_id) qs.set('party_id', params.party_id);
      if (params.status) qs.set('status', params.status);
      const query = qs.toString();
      return apiCall<Onboarding[]>(`/onboardings${query ? `?${query}` : ''}`);
    },
    get: (id: string) => apiCall<Onboarding>(`/onboardings/${id}`),
    create: (data: CreateOnboardingInput) =>
      apiCall<Onboarding>('/onboardings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateOnboardingInput) =>
      apiCall<Onboarding>(`/onboardings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStep: (id: string, stepId: string, completed: boolean) =>
      apiCall<Onboarding>(`/onboardings/${id}/steps/${stepId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }),
  },
};
