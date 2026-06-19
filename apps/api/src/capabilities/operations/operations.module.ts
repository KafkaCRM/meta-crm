import { Module } from '@nestjs/common';
import { TenantModule } from '../../core/tenant/tenant.module';
import { CapabilityModule } from '../../core/capability/capability.module';
import { ProductCategoriesController } from './product-categories.controller';
import { ProductCategoriesService } from './product-categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [TenantModule, CapabilityModule],
  controllers: [ProductCategoriesController, ProductsController, WarehousesController, StockController, StockMovementsController, AssetsController],
  providers: [ProductCategoriesService, ProductsService, WarehousesService, StockService, StockMovementsService, AssetsService],
  exports: [ProductCategoriesService, ProductsService, WarehousesService, StockService, StockMovementsService, AssetsService],
})
export class OperationsModule {}
