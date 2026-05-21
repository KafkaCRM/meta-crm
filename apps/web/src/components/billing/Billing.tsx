import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capabilitiesApi, type Invoice, type InvoiceLineItem, type Payment } from '@/api/capabilities';
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
import { Receipt, DollarSign, Plus, Trash2, Calendar, FileText, ChevronRight, Check } from 'lucide-react';
import dayjs from 'dayjs';

export function Billing() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Forms state
  const [partyId, setPartyId] = useState('');
  const [dueDate, setDueDate] = useState(dayjs().add(14, 'day').format('YYYY-MM-DD'));
  const [items, setItems] = useState<{ description: string; quantity: number; unit_price: number }[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  // Register Payment state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payReference, setPayReference] = useState('');

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['invoices', 'stats'],
    queryFn: () => capabilitiesApi.billing.getStats(),
  });

  // Fetch invoices list
  const [filterStatus, setFilterStatus] = useState('');
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', 'list', filterStatus],
    queryFn: () => capabilitiesApi.billing.list({ status: filterStatus || undefined }),
  });

  // Fetch contacts
  const { data: contactsData } = useQuery({
    queryKey: ['parties', 'all'],
    queryFn: () => partiesApi.list({ limit: 100 }),
  });
  const contacts = contactsData?.data ?? [];

  // Create Invoice mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => capabilitiesApi.billing.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully!');
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: () => toast.error('Failed to create invoice'),
  });

  // Register Payment mutation
  const payMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      capabilitiesApi.billing.registerPayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment registered successfully!');
      setIsPayOpen(false);
      setIsDetailOpen(false);
    },
    onError: () => toast.error('Failed to register payment'),
  });

  const resetCreateForm = () => {
    setPartyId('');
    setDueDate(dayjs().add(14, 'day').format('YYYY-MM-DD'));
    setItems([{ description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, key: string, val: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [key]: key === 'description' ? val : Number(val),
    };
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const handleCreateInvoice = () => {
    if (!partyId) {
      toast.error('Please select a contact');
      return;
    }
    const validItems = items.filter((item) => item.description && item.quantity > 0 && item.unit_price > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid line item');
      return;
    }

    createMutation.mutate({
      party_id: partyId,
      due_date: dueDate,
      items: validItems,
    });
  };

  const handlePayClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // Suggest remaining amount
    const paidAmount = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    setPayAmount(invoice.amount - paidAmount);
    setPayMethod('bank_transfer');
    setPayReference('');
    setIsPayOpen(true);
  };

  const handleRegisterPayment = () => {
    if (!selectedInvoice || payAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    payMutation.mutate({
      id: selectedInvoice.id,
      data: {
        amount: payAmount,
        method: payMethod,
        reference: payReference,
      },
    });
  };

  const handleInvoiceDetail = async (id: string) => {
    try {
      const invoice = await capabilitiesApi.billing.get(id);
      setSelectedInvoice(invoice);
      setIsDetailOpen(true);
    } catch {
      toast.error('Failed to load invoice details');
    }
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Invoicing & Billing</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Manage customer billing ledgers, generate invoices and track payments</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if(!open) resetCreateForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-9 px-4">
              <Plus size={16} className="mr-1.5" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#111111]">Create New Invoice</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="party" className="text-xs font-semibold text-[#626260]">Bill To Contact *</Label>
                  <select
                    id="party"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                  >
                    <option value="">Select Contact</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="due_date" className="text-xs font-semibold text-[#626260]">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-[#626260]">Line Items</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddItem}
                    className="h-7 text-xs border-[#d3cec6] text-[#626260]"
                  >
                    Add Item
                  </Button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 border border-[#ebe7e1] rounded-lg p-2 bg-[#f5f1ec]">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Item Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="bg-white border-[#d3cec6] h-8 text-xs flex-grow focus-visible:ring-[#111111]"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="bg-white border-[#d3cec6] h-8 w-16 text-xs text-center focus-visible:ring-[#111111]"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="bg-white border-[#d3cec6] h-8 w-24 text-xs text-center focus-visible:ring-[#111111]"
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

              <div className="flex justify-between items-center text-sm font-semibold p-2.5 bg-[#f5f1ec] rounded-lg border border-[#ebe7e1]">
                <span className="text-[#626260]">Total Invoice Amount:</span>
                <span className="text-[#111111] font-mono text-base">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={createMutation.isPending}
                className="bg-[#111111] hover:bg-black text-white"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-2xs font-semibold text-[#9c9fa5] uppercase tracking-wider">Total Invoiced</p>
                <h3 className="text-lg font-bold text-[#111111] font-mono">${stats.total_billed.toFixed(2)}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 text-green-700">
                <Check size={20} />
              </div>
              <div>
                <p className="text-2xs font-semibold text-[#9c9fa5] uppercase tracking-wider">Total Collected</p>
                <h3 className="text-lg font-bold text-[#111111] font-mono">${stats.total_paid.toFixed(2)}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-700">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-2xs font-semibold text-[#9c9fa5] uppercase tracking-wider">Outstanding Ledger</p>
                <h3 className="text-lg font-bold text-[#111111] font-mono">${stats.total_outstanding.toFixed(2)}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 text-red-700">
                <Receipt size={20} />
              </div>
              <div>
                <p className="text-2xs font-semibold text-[#9c9fa5] uppercase tracking-wider">Overdue Bills</p>
                <h3 className="text-lg font-bold text-[#111111] font-mono">{stats.overdue_count}</h3>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices List */}
      <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base font-semibold text-[#111111]">Ledger Invoices</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2 py-1 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#626260]"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingInvoices ? (
            <div className="text-center py-8 text-[#9c9fa5]">Loading ledger data...</div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-[#9c9fa5]">No invoices found matching criteria.</div>
          ) : (
            <Table>
              <TableHeader className="bg-[#f5f1ec]">
                <TableRow className="hover:bg-transparent border-b border-[#ebe7e1]">
                  <TableHead className="text-xs font-semibold text-[#626260]">Contact</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260]">Due Date</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260] text-right">Amount</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260] text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-[#626260] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: Invoice) => {
                  const totalPaid = inv.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
                  const isFullyPaid = inv.status === 'paid' || totalPaid >= inv.amount;

                  return (
                    <TableRow key={inv.id} className="border-b border-[#ebe7e1] hover:bg-[#f5f1ec]/30">
                      <TableCell className="font-medium text-[#111111]">{inv.party?.name}</TableCell>
                      <TableCell className="text-xs text-[#626260]">
                        {dayjs(inv.due_date).format('DD MMM YYYY')}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-[#111111]">
                        ${inv.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                          isFullyPaid
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}>
                          {inv.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleInvoiceDetail(inv.id)}
                          className="h-7 text-xs text-[#111111] hover:bg-[#f5f1ec]"
                        >
                          View Details
                        </Button>
                        {!isFullyPaid && (
                          <Button
                            size="sm"
                            onClick={() => handlePayClick(inv)}
                            className="h-7 text-xs bg-[#111111] hover:bg-black text-white"
                          >
                            Collect Payment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pay dialog */}
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="max-w-sm bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111111]">Collect Invoice Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <Label htmlFor="pay_amount" className="text-xs font-semibold text-[#626260]">Amount *</Label>
              <Input
                id="pay_amount"
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay_method" className="text-xs font-semibold text-[#626260]">Payment Method *</Label>
              <select
                id="pay_method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Credit / Debit Card</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay_reference" className="text-xs font-semibold text-[#626260]">Reference Number (Tx ID)</Label>
              <Input
                id="pay_reference"
                placeholder="E.g., Txn-90184"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                className="bg-[#f5f1ec] border-[#d3cec6] focus-visible:ring-[#111111]"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPayOpen(false)} className="border-[#d3cec6] text-[#626260]">
              Cancel
            </Button>
            <Button onClick={handleRegisterPayment} disabled={payMutation.isPending} className="bg-[#111111] hover:bg-black text-white">
              {payMutation.isPending ? 'Processing...' : 'Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#111111]">Invoice #{selectedInvoice?.id.slice(-6)}</DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#9c9fa5]">Bill To:</p>
                  <p className="font-medium text-[#111111] mt-0.5">{selectedInvoice.party?.name}</p>
                </div>
                <div>
                  <p className="font-semibold text-[#9c9fa5] text-right">Due Date:</p>
                  <p className="font-medium text-[#111111] mt-0.5 text-right">{dayjs(selectedInvoice.due_date).format('DD MMM YYYY')}</p>
                </div>
              </div>

              <Separator className="bg-[#ebe7e1]" />

              <div>
                <p className="text-xs font-semibold text-[#626260] mb-1.5">Line Items</p>
                <div className="border border-[#ebe7e1] rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#f5f1ec]">
                      <TableRow className="border-b border-[#ebe7e1]">
                        <TableHead className="text-2xs font-semibold text-[#626260] h-7 py-1">Description</TableHead>
                        <TableHead className="text-2xs font-semibold text-[#626260] h-7 py-1 text-center">Qty</TableHead>
                        <TableHead className="text-2xs font-semibold text-[#626260] h-7 py-1 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedInvoice.items?.map((item) => (
                        <TableRow key={item.id} className="border-b border-[#ebe7e1] hover:bg-transparent">
                          <TableCell className="text-xs py-1.5">{item.description}</TableCell>
                          <TableCell className="text-xs text-center py-1.5">{item.quantity} x ${item.unit_price}</TableCell>
                          <TableCell className="text-right text-xs py-1.5 font-mono">${item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between items-center text-sm font-semibold p-2 bg-[#f5f1ec] border border-[#ebe7e1] rounded-lg">
                <span className="text-[#626260]">Invoice Total:</span>
                <span className="text-[#111111] font-mono">${selectedInvoice.amount.toFixed(2)}</span>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#626260] mb-1.5">Payment History</p>
                {(!selectedInvoice.payments || selectedInvoice.payments.length === 0) ? (
                  <p className="text-xs text-[#9c9fa5] italic">No payments collected yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {selectedInvoice.payments.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-xs p-1.5 border border-[#ebe7e1] rounded bg-white">
                        <div className="flex items-center gap-1.5">
                          <Check className="text-green-600 h-3.5 w-3.5" />
                          <span>{p.method.replace('_', ' ')} {p.reference && `(${p.reference})`}</span>
                        </div>
                        <span className="font-semibold text-green-700">${p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="border-[#d3cec6] text-[#626260] w-full">
              Close
            </Button>
            {selectedInvoice && selectedInvoice.status !== 'paid' && (
              <Button onClick={() => handlePayClick(selectedInvoice)} className="bg-[#111111] hover:bg-black text-white w-full">
                Collect Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
