import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capabilitiesApi, type Order, type OrderLineItem } from '@/api/capabilities';
import { partiesApi } from '@/api/parties';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShoppingCart, Plus, Trash2, ChevronRight, Package, CreditCard, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { useCurrency } from '@/contexts/currency.context';

export function Orders() {
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Forms state
  const [partyId, setPartyId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [items, setItems] = useState<{ product_name: string; quantity: number; unit_price: number }[]>([
    { product_name: '', quantity: 1, unit_price: 0 },
  ]);

  // Fetch orders list
  const [filterStatus, setFilterStatus] = useState('');
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['orders', 'list', filterStatus],
    queryFn: () => capabilitiesApi.orders.list({ status: filterStatus || undefined }),
  });

  // Fetch contacts
  const { data: contactsData } = useQuery({
    queryKey: ['parties', 'all'],
    queryFn: () => partiesApi.list({ limit: 100 }),
  });
  const contacts = contactsData?.data ?? [];

  // Create Order mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => capabilitiesApi.orders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order created successfully!');
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: () => toast.error('Failed to create order'),
  });

  // Update Status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      capabilitiesApi.orders.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order status updated!');
      // Update selected order details view if open
      setSelectedOrder(data);
    },
    onError: () => toast.error('Failed to update order status'),
  });

  const resetCreateForm = () => {
    setPartyId('');
    setPaymentMethod('credit_card');
    setItems([{ product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const handleAddItem = () => {
    setItems([...items, { product_name: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, key: 'product_name' | 'quantity' | 'unit_price', val: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [key]: key === 'product_name' ? val : Number(val),
    } as typeof items[number];
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const handleCreateOrder = () => {
    if (!partyId) {
      toast.error('Please select a customer');
      return;
    }
    const validItems = items.filter((item) => item.product_name && item.quantity > 0 && item.unit_price > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid product line item');
      return;
    }

    createMutation.mutate({
      party_id: partyId,
      total_amount: calculateTotal(),
      payment_method: paymentMethod,
      items: validItems,
    });
  };

  const handleOrderDetail = async (id: string) => {
    try {
      const order = await capabilitiesApi.orders.get(id);
      setSelectedOrder(order);
      setIsDetailOpen(true);
    } catch {
      toast.error('Failed to load order details');
    }
  };

  const handleStatusChange = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, data: { status } });
  };

  const handlePaymentStatusChange = (id: string, payment_status: string) => {
    updateStatusMutation.mutate({ id, data: { payment_status } });
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'shipped':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'unpaid':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Order Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track customer orders, process fulfillment status and record payments</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open) resetCreateForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-[#1e293b] text-white rounded-lg text-sm font-medium h-9 px-4">
              <Plus size={16} className="mr-1.5" />
              New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-card border border-border rounded-xl shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-foreground">Place New Order</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="party" className="text-xs font-semibold text-muted-foreground">Customer *</Label>
                  <select
                    id="party"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                  >
                    <option value="">Select Customer</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="payment_method" className="text-xs font-semibold text-muted-foreground">Payment Method</Label>
                  <select
                    id="payment_method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash_on_delivery">Cash on Delivery</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-muted-foreground">Product Items</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddItem}
                    className="h-7 text-xs border-border text-muted-foreground"
                  >
                    Add Product
                  </Button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 border border-border rounded-lg p-2 bg-background">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Product Name"
                        value={item.product_name}
                        onChange={(e) => handleItemChange(idx, 'product_name', e.target.value)}
                        className="bg-card border-border h-8 text-xs flex-grow focus-visible:ring-[#0f172a]"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="bg-card border-border h-8 w-16 text-xs text-center focus-visible:ring-[#0f172a]"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="bg-card border-border h-8 w-24 text-xs text-center focus-visible:ring-[#0f172a]"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length === 1}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-semibold p-2.5 bg-background rounded-lg border border-border">
                <span className="text-muted-foreground">Total Order Price:</span>
                <span className="text-foreground font-mono text-base">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-border text-muted-foreground hover:bg-background"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrder}
                disabled={createMutation.isPending}
                className="bg-primary hover:bg-[#1e293b] text-white"
              >
                {createMutation.isPending ? 'Placing...' : 'Place Order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Orders List */}
      <Card className="bg-card border-border rounded-xl shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold text-foreground">Recent Orders</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-xs rounded-md bg-background border border-border text-muted-foreground"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingOrders ? (
            <div className="text-center py-8 text-muted-foreground">Loading order details...</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No orders found matching criteria.</div>
          ) : (
            <Table>
              <TableHeader className="bg-background">
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="text-xs font-semibold text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Order Date</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground">Payment</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Total Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-center">Order Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((ord: Order) => (
                  <TableRow key={ord.id} className="border-b border-border hover:bg-background/30">
                    <TableCell className="font-medium text-foreground">{ord.party?.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dayjs(ord.created_at).format('DD MMM YYYY HH:mm')}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase border ${getPaymentStatusBadge(ord.payment_status)}`}>
                        {ord.payment_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatCurrency(ord.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase border ${getOrderStatusBadge(ord.status)}`}>
                        {ord.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOrderDetail(ord.id)}
                        className="h-7 text-xs text-foreground hover:bg-background"
                      >
                        Details
                        <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md bg-card border border-border rounded-xl shadow-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">Order Details</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-muted-foreground">Customer:</p>
                  <p className="font-medium text-foreground mt-0.5">{selectedOrder.party?.name}</p>
                  <p className="text-muted-foreground mt-0.5">{selectedOrder.party?.email || ''}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground text-right">Order Date:</p>
                  <p className="font-medium text-foreground mt-0.5 text-right">{dayjs(selectedOrder.created_at).format('DD MMM YYYY HH:mm')}</p>
                </div>
              </div>

              <Separator className="bg-[#e2e8f0]" />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-2xs font-semibold text-muted-foreground uppercase">Update Order Status</Label>
                  <select
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground"
                  >
                    <option value="pending">Pending</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-2xs font-semibold text-muted-foreground uppercase">Update Payment Status</Label>
                  <select
                    value={selectedOrder.payment_status}
                    onChange={(e) => handlePaymentStatusChange(selectedOrder.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border text-foreground"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <Separator className="bg-[#e2e8f0]" />

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Product Summary</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow className="border-b border-border">
                        <TableHead className="text-2xs font-semibold text-muted-foreground h-7 py-1">Item</TableHead>
                        <TableHead className="text-2xs font-semibold text-muted-foreground h-7 py-1 text-center">Qty</TableHead>
                        <TableHead className="text-2xs font-semibold text-muted-foreground h-7 py-1 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items?.map((item) => (
                        <TableRow key={item.id} className="border-b border-border hover:bg-transparent">
                          <TableCell className="text-xs py-1.5">{item.product_name}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">{item.quantity} x {formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right text-xs py-1.5 font-mono">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-semibold p-2 bg-background border border-border rounded-lg">
                <span className="text-muted-foreground">Grand Total:</span>
                <span className="text-foreground font-mono">{formatCurrency(selectedOrder.total_amount)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-border text-muted-foreground w-full">
              Close Detail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
