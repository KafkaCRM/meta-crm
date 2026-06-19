import { createRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes';
import { ProductCategoryList } from '@/components/operations/ProductCategoryList';
import { ProductList } from '@/components/operations/ProductList';
import { WarehouseList } from '@/components/operations/WarehouseList';
import { StockList } from '@/components/operations/StockList';
import { StockMovementList } from '@/components/operations/StockMovementList';
import { AssetList } from '@/components/operations/AssetList';
import { CapabilityGate } from '@/components/shared/CapabilityGate';

const gate = (children: React.ReactNode) => (
  <CapabilityGate capabilityId="capability/operations" capabilityName="Catalog, Inventory & Assets"
    description="Your workspace has not enabled the Operations module. Enable it from Capabilities settings to manage products, inventory, and assets.">
    {children}
  </CapabilityGate>
);

export const productCategoriesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/product-categories', component: () => gate(<ProductCategoryList />) });
export const productsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/products', component: () => gate(<ProductList />) });
export const warehousesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/warehouses', component: () => gate(<WarehouseList />) });
export const stockRoute = createRoute({ getParentRoute: () => rootRoute, path: '/stock', component: () => gate(<StockList />) });
export const stockMovementsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/stock-movements', component: () => gate(<StockMovementList />) });
export const assetsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/assets', component: () => gate(<AssetList />) });
