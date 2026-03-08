SET @db := DATABASE();

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='supply_receipt_items')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='supply_receipt_items' AND CONSTRAINT_NAME='fk_supply_items_parameter'),
  'ALTER TABLE supply_receipt_items DROP FOREIGN KEY fk_supply_items_parameter',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='supply_receipt_items')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='supply_receipt_items' AND CONSTRAINT_NAME='fk_supply_items_parameter'),
  'ALTER TABLE supply_receipt_items ADD CONSTRAINT fk_supply_items_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_layers')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='inventory_stock_layers' AND CONSTRAINT_NAME='fk_inventory_layers_parameter'),
  'ALTER TABLE inventory_stock_layers DROP FOREIGN KEY fk_inventory_layers_parameter',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='inventory_stock_layers')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='inventory_stock_layers' AND CONSTRAINT_NAME='fk_inventory_layers_parameter'),
  'ALTER TABLE inventory_stock_layers ADD CONSTRAINT fk_inventory_layers_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='production_batch_items')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='production_batch_items' AND CONSTRAINT_NAME='fk_batch_items_parameter'),
  'ALTER TABLE production_batch_items DROP FOREIGN KEY fk_batch_items_parameter',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='production_batch_items')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='production_batch_items' AND CONSTRAINT_NAME='fk_batch_items_parameter'),
  'ALTER TABLE production_batch_items ADD CONSTRAINT fk_batch_items_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='production_leftover_layers')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='production_leftover_layers' AND CONSTRAINT_NAME='fk_leftovers_parameter'),
  'ALTER TABLE production_leftover_layers DROP FOREIGN KEY fk_leftovers_parameter',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='production_leftover_layers')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='production_leftover_layers' AND CONSTRAINT_NAME='fk_leftovers_parameter'),
  'ALTER TABLE production_leftover_layers ADD CONSTRAINT fk_leftovers_parameter FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_orders')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_orders' AND CONSTRAINT_NAME='fk_distributor_orders_distributor'),
  'ALTER TABLE distributor_orders DROP FOREIGN KEY fk_distributor_orders_distributor',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_orders')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_orders' AND CONSTRAINT_NAME='fk_distributor_orders_distributor'),
  'ALTER TABLE distributor_orders ADD CONSTRAINT fk_distributor_orders_distributor FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_orders')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_orders' AND CONSTRAINT_NAME='fk_distributor_orders_batch'),
  'ALTER TABLE distributor_orders DROP FOREIGN KEY fk_distributor_orders_batch',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_orders')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_orders' AND CONSTRAINT_NAME='fk_distributor_orders_batch'),
  'ALTER TABLE distributor_orders ADD CONSTRAINT fk_distributor_orders_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_order_lines')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_order_lines' AND CONSTRAINT_NAME='fk_distributor_order_lines_batch'),
  'ALTER TABLE distributor_order_lines DROP FOREIGN KEY fk_distributor_order_lines_batch',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='distributor_order_lines')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='distributor_order_lines' AND CONSTRAINT_NAME='fk_distributor_order_lines_batch'),
  'ALTER TABLE distributor_order_lines ADD CONSTRAINT fk_distributor_order_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='retail_sales')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='retail_sales' AND CONSTRAINT_NAME='fk_retail_sales_batch'),
  'ALTER TABLE retail_sales DROP FOREIGN KEY fk_retail_sales_batch',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='retail_sales')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='retail_sales' AND CONSTRAINT_NAME='fk_retail_sales_batch'),
  'ALTER TABLE retail_sales ADD CONSTRAINT fk_retail_sales_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='retail_sale_lines')
  AND EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='retail_sale_lines' AND CONSTRAINT_NAME='fk_retail_sale_lines_batch'),
  'ALTER TABLE retail_sale_lines DROP FOREIGN KEY fk_retail_sale_lines_batch',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql := IF(
  EXISTS(SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=@db AND TABLE_NAME='retail_sale_lines')
  AND NOT EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@db AND TABLE_NAME='retail_sale_lines' AND CONSTRAINT_NAME='fk_retail_sale_lines_batch'),
  'ALTER TABLE retail_sale_lines ADD CONSTRAINT fk_retail_sale_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
