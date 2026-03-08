USE amsal_erp;

CREATE TABLE IF NOT EXISTS packaging_sizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  volume_liters DECIMAL(10,3) NOT NULL,
  bottle_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  cap_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  label_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  extra_packaging_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  default_selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_batch_packaging_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL,
  bottles_allocated INT NOT NULL DEFAULT 0,
  liters_allocated DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit_packaging_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_liquid_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  unit_total_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
  selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_batch_packaging_batch FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  CONSTRAINT fk_batch_packaging_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

ALTER TABLE finished_goods_layers
  ADD COLUMN IF NOT EXISTS packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id,
  ADD COLUMN IF NOT EXISTS size_name VARCHAR(120) NULL AFTER packaging_size_id,
  ADD COLUMN IF NOT EXISTS volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name,
  ADD COLUMN IF NOT EXISTS selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cost_per_bottle;

ALTER TABLE finished_goods_layers
  ADD INDEX IF NOT EXISTS idx_finished_goods_size (packaging_size_id),
  ADD CONSTRAINT fk_finished_goods_packaging_size
    FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS distributor_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  distributor_order_id BIGINT UNSIGNED NOT NULL,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_issued INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_distributor_order_lines_order FOREIGN KEY (distributor_order_id) REFERENCES distributor_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_distributor_order_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id),
  CONSTRAINT fk_distributor_order_lines_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS retail_sale_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  retail_sale_id BIGINT UNSIGNED NOT NULL,
  selected_batch_id BIGINT UNSIGNED NOT NULL,
  packaging_size_id BIGINT UNSIGNED NULL,
  size_name VARCHAR(120) NOT NULL,
  volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0,
  bottles_sold INT NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_per_bottle DECIMAL(12,4) NOT NULL DEFAULT 0,
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  gross_profit DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_retail_sale_lines_sale FOREIGN KEY (retail_sale_id) REFERENCES retail_sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_retail_sale_lines_batch FOREIGN KEY (selected_batch_id) REFERENCES production_batches(id),
  CONSTRAINT fk_retail_sale_lines_size FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL
);

ALTER TABLE distributor_order_batch_allocations
  ADD COLUMN IF NOT EXISTS packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id,
  ADD COLUMN IF NOT EXISTS size_name VARCHAR(120) NULL AFTER packaging_size_id,
  ADD COLUMN IF NOT EXISTS volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name;

ALTER TABLE distributor_order_batch_allocations
  ADD INDEX IF NOT EXISTS idx_distributor_alloc_size (packaging_size_id),
  ADD CONSTRAINT fk_distributor_alloc_packaging_size
    FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL;

ALTER TABLE retail_sale_batch_allocations
  ADD COLUMN IF NOT EXISTS packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id,
  ADD COLUMN IF NOT EXISTS size_name VARCHAR(120) NULL AFTER packaging_size_id,
  ADD COLUMN IF NOT EXISTS volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name;

ALTER TABLE retail_sale_batch_allocations
  ADD INDEX IF NOT EXISTS idx_retail_alloc_size (packaging_size_id),
  ADD CONSTRAINT fk_retail_alloc_packaging_size
    FOREIGN KEY (packaging_size_id) REFERENCES packaging_sizes(id) ON DELETE SET NULL;
