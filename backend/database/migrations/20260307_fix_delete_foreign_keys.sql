ALTER TABLE supply_receipt_items
  DROP FOREIGN KEY fk_supply_items_parameter,
  ADD CONSTRAINT fk_supply_items_parameter
    FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE;

ALTER TABLE inventory_stock_layers
  DROP FOREIGN KEY fk_inventory_layers_parameter,
  ADD CONSTRAINT fk_inventory_layers_parameter
    FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE;

ALTER TABLE production_batch_items
  DROP FOREIGN KEY fk_batch_items_parameter,
  ADD CONSTRAINT fk_batch_items_parameter
    FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE;

ALTER TABLE production_leftover_layers
  DROP FOREIGN KEY fk_leftovers_parameter,
  ADD CONSTRAINT fk_leftovers_parameter
    FOREIGN KEY (parameter_id) REFERENCES production_parameters(id) ON DELETE CASCADE;

ALTER TABLE distributor_orders
  DROP FOREIGN KEY fk_distributor_orders_distributor,
  ADD CONSTRAINT fk_distributor_orders_distributor
    FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE,
  DROP FOREIGN KEY fk_distributor_orders_batch,
  ADD CONSTRAINT fk_distributor_orders_batch
    FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;

ALTER TABLE distributor_order_lines
  DROP FOREIGN KEY fk_distributor_order_lines_batch,
  ADD CONSTRAINT fk_distributor_order_lines_batch
    FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;

ALTER TABLE retail_sales
  DROP FOREIGN KEY fk_retail_sales_batch,
  ADD CONSTRAINT fk_retail_sales_batch
    FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;

ALTER TABLE retail_sale_lines
  DROP FOREIGN KEY fk_retail_sale_lines_batch,
  ADD CONSTRAINT fk_retail_sale_lines_batch
    FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id) ON DELETE CASCADE;
