import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capabilitiesApi, type Property } from '@/api/capabilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Home, MapPin, BedDouble, Bath, Maximize2, Plus, Edit, Trash2, Sliders } from 'lucide-react';

export function Properties() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [bedrooms, setBedrooms] = useState<number>(0);
  const [bathrooms, setBathrooms] = useState<number>(0);
  const [squareFootage, setSquareFootage] = useState<number>(0);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState('available');
  const [imageUrl, setImageUrl] = useState('');

  // Filters state
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState<number | undefined>(undefined);
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | undefined>(undefined);
  const [filterBedrooms, setFilterBedrooms] = useState<number | undefined>(undefined);

  // Fetch properties list
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: ['properties', filterCity, filterStatus, filterMinPrice, filterMaxPrice, filterBedrooms],
    queryFn: () =>
      capabilitiesApi.properties.list({
        city: filterCity || undefined,
        status: filterStatus || undefined,
        min_price: filterMinPrice || undefined,
        max_price: filterMaxPrice || undefined,
        bedrooms: filterBedrooms || undefined,
      }),
  });

  // Create/Edit Mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingProperty) {
        return capabilitiesApi.properties.update(editingProperty.id, data);
      }
      return capabilitiesApi.properties.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(editingProperty ? 'Property updated!' : 'Property listed successfully!');
      setIsOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to save property'),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => capabilitiesApi.properties.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property listing removed');
    },
    onError: () => toast.error('Failed to delete property'),
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAddress('');
    setCity('');
    setPrice(0);
    setBedrooms(0);
    setBathrooms(0);
    setSquareFootage(0);
    setLatitude(undefined);
    setLongitude(undefined);
    setStatus('available');
    setImageUrl('');
    setEditingProperty(null);
  };

  const handleEditClick = (prop: Property) => {
    setEditingProperty(prop);
    setTitle(prop.title);
    setDescription(prop.description || '');
    setAddress(prop.address);
    setCity(prop.city);
    setPrice(prop.price);
    setBedrooms(prop.bedrooms);
    setBathrooms(prop.bathrooms);
    setSquareFootage(prop.square_footage);
    setLatitude(prop.latitude || undefined);
    setLongitude(prop.longitude || undefined);
    setStatus(prop.status);
    setImageUrl(prop.images?.[0] || '');
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!title || !address || !city || price <= 0 || squareFootage <= 0) {
      toast.error('Please complete all required fields');
      return;
    }

    saveMutation.mutate({
      title,
      description,
      address,
      city,
      price,
      bedrooms,
      bathrooms,
      square_footage: squareFootage,
      latitude,
      longitude,
      status,
      images: imageUrl ? [imageUrl] : [],
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this property listing?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Property Listings</h1>
          <p className="text-sm text-[#9c9fa5] mt-0.5">Manage real estate listings, tracking unit availability and details</p>
        </div>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#111111] hover:bg-black text-white rounded-lg text-sm font-medium h-9 px-4">
              <Plus size={16} className="mr-1.5" />
              Add Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-white border border-[#d3cec6] rounded-xl shadow-lg p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-[#111111]">
                {editingProperty ? 'Edit Property Listing' : 'Add Property Listing'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="title" className="text-xs font-semibold text-[#626260]">Property Title *</Label>
                  <Input
                    id="title"
                    placeholder="E.g., Sunset Villa Apartment"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status" className="text-xs font-semibold text-[#626260]">Status</Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111]"
                  >
                    <option value="available">Available</option>
                    <option value="pending">Pending Sale</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="address" className="text-xs font-semibold text-[#626260]">Street Address *</Label>
                  <Input
                    id="address"
                    placeholder="128 Maple Road"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-xs font-semibold text-[#626260]">City *</Label>
                  <Input
                    id="city"
                    placeholder="New York"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="price" className="text-xs font-semibold text-[#626260]">Listing Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bedrooms" className="text-xs font-semibold text-[#626260]">Beds</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(Number(e.target.value))}
                    className="bg-[#f5f1ec] border-[#d3cec6] text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bathrooms" className="text-xs font-semibold text-[#626260]">Baths</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(Number(e.target.value))}
                    className="bg-[#f5f1ec] border-[#d3cec6] text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="sqft" className="text-xs font-semibold text-[#626260]">Square Footage (sqft) *</Label>
                  <Input
                    id="sqft"
                    type="number"
                    value={squareFootage}
                    onChange={(e) => setSquareFootage(Number(e.target.value))}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lat" className="text-xs font-semibold text-[#626260]">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    placeholder="40.7128"
                    value={latitude ?? ''}
                    onChange={(e) => setLatitude(e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lng" className="text-xs font-semibold text-[#626260]">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    placeholder="-74.0060"
                    value={longitude ?? ''}
                    onChange={(e) => setLongitude(e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-[#f5f1ec] border-[#d3cec6]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="image_url" className="text-xs font-semibold text-[#626260]">Photo URL</Label>
                <Input
                  id="image_url"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="bg-[#f5f1ec] border-[#d3cec6]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="desc" className="text-xs font-semibold text-[#626260]">Public Description</Label>
                <textarea
                  id="desc"
                  rows={2}
                  placeholder="Details about the location, amenities..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111] focus:outline-none focus:ring-1 focus:ring-[#111111]"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="border-[#d3cec6] text-[#626260] hover:bg-[#f5f1ec]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-[#111111] hover:bg-black text-white"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main layout: Filters + Grid */}
      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Sidebar Filters */}
        <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-[#9c9fa5] flex items-center gap-1.5">
              <Sliders size={14} />
              Filter Listings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="f-city" className="text-xs text-[#626260]">City</Label>
              <Input
                id="f-city"
                placeholder="E.g., Boston"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="bg-[#f5f1ec] border-[#d3cec6] h-8 text-xs placeholder:text-[#9c9fa5]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="f-status" className="text-xs text-[#626260]">Status</Label>
              <select
                id="f-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md bg-[#f5f1ec] border border-[#d3cec6] text-[#111111]"
              >
                <option value="">All Listings</option>
                <option value="available">Available</option>
                <option value="pending">Pending</option>
                <option value="sold">Sold</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="f-min" className="text-xs text-[#626260]">Min Price ($)</Label>
                <Input
                  id="f-min"
                  type="number"
                  placeholder="Min"
                  value={filterMinPrice ?? ''}
                  onChange={(e) => setFilterMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-[#f5f1ec] border-[#d3cec6] h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="f-max" className="text-xs text-[#626260]">Max Price ($)</Label>
                <Input
                  id="f-max"
                  type="number"
                  placeholder="Max"
                  value={filterMaxPrice ?? ''}
                  onChange={(e) => setFilterMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-[#f5f1ec] border-[#d3cec6] h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="f-beds" className="text-xs text-[#626260]">Min Bedrooms</Label>
              <Input
                id="f-beds"
                type="number"
                placeholder="2"
                value={filterBedrooms ?? ''}
                onChange={(e) => setFilterBedrooms(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-[#f5f1ec] border-[#d3cec6] h-8 text-xs"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterCity('');
                setFilterStatus('');
                setFilterMinPrice(undefined);
                setFilterMaxPrice(undefined);
                setFilterBedrooms(undefined);
              }}
              className="w-full text-xs border-[#d3cec6] text-[#626260]"
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>

        {/* Main Grid */}
        <div className="md:col-span-3">
          {loadingProperties ? (
            <div className="text-center py-12 text-[#9c9fa5]">Loading properties...</div>
          ) : properties.length === 0 ? (
            <Card className="bg-white border-[#d3cec6] rounded-xl shadow-none py-12 text-center">
              <Home className="mx-auto h-8 w-8 text-[#9c9fa5] mb-2" />
              <p className="text-sm font-medium text-[#111111]">No properties listed</p>
              <p className="text-xs text-[#9c9fa5] mt-1">Create a property listing to get started.</p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((prop: Property) => (
                <Card key={prop.id} className="bg-white border-[#d3cec6] rounded-xl shadow-none hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
                  <div>
                    {prop.images?.[0] ? (
                      <div className="h-40 w-full overflow-hidden bg-[#f5f1ec] relative">
                        <img
                          src={prop.images[0]}
                          alt={prop.title}
                          className="h-full w-full object-cover"
                        />
                        <span className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold uppercase border ${
                          prop.status === 'available'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : prop.status === 'pending'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {prop.status}
                        </span>
                      </div>
                    ) : (
                      <div className="h-40 w-full bg-[#f5f1ec] flex items-center justify-center relative">
                        <Home size={32} className="text-[#9c9fa5]" />
                        <span className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-semibold uppercase border ${
                          prop.status === 'available'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : prop.status === 'pending'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {prop.status}
                        </span>
                      </div>
                    )}

                    <CardContent className="p-4 space-y-2">
                      <div>
                        <h4 className="font-bold text-sm text-[#111111] truncate">{prop.title}</h4>
                        <p className="text-2xs text-[#9c9fa5] flex items-center gap-0.5 mt-0.5">
                          <MapPin size={10} />
                          {prop.address}, {prop.city}
                        </p>
                      </div>

                      <div className="font-mono text-base font-bold text-[#111111]">
                        ${prop.price.toLocaleString()}
                      </div>

                      {prop.description && (
                        <p className="text-2xs text-[#626260] line-clamp-2 italic">
                          "{prop.description}"
                        </p>
                      )}

                      <Separator className="bg-[#ebe7e1]" />

                      <div className="flex items-center justify-between text-2xs font-semibold text-[#626260]">
                        <span className="flex items-center gap-1">
                          <BedDouble size={12} className="text-[#9c9fa5]" />
                          {prop.bedrooms} Bed
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath size={12} className="text-[#9c9fa5]" />
                          {prop.bathrooms} Bath
                        </span>
                        <span className="flex items-center gap-1">
                          <Maximize2 size={12} className="text-[#9c9fa5]" />
                          {prop.square_footage} sqft
                        </span>
                      </div>
                    </CardContent>
                  </div>

                  <CardFooter className="p-3 border-t border-[#ebe7e1] flex justify-end gap-1.5 bg-[#f5f1ec]/20">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditClick(prop)}
                      className="h-7 w-7 text-[#626260] hover:text-[#111111]"
                    >
                      <Edit size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(prop.id)}
                      className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
