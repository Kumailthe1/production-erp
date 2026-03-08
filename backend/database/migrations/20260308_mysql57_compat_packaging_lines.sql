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
  KEY idx_batch_packaging_batch (batch_id),
  KEY idx_batch_packaging_size (packaging_size_id)
);

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE finished_goods_layers ADD COLUMN packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_layers'
    AND column_name = 'packaging_size_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE finished_goods_layers ADD COLUMN size_name VARCHAR(120) NULL AFTER packaging_size_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_layers'
    AND column_name = 'size_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE finished_goods_layers ADD COLUMN volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_layers'
    AND column_name = 'volume_liters'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE finished_goods_layers ADD COLUMN selling_price_per_bottle DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cost_per_bottle',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_layers'
    AND column_name = 'selling_price_per_bottle'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
  KEY idx_distributor_order_lines_order (distributor_order_id),
  KEY idx_distributor_order_lines_batch (selected_batch_id),
  KEY idx_distributor_order_lines_size (packaging_size_id)
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
  KEY idx_retail_sale_lines_sale (retail_sale_id),
  KEY idx_retail_sale_lines_batch (selected_batch_id),
  KEY idx_retail_sale_lines_size (packaging_size_id)
);

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE distributor_order_batch_allocations ADD COLUMN packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'distributor_order_batch_allocations'
    AND column_name = 'packaging_size_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE distributor_order_batch_allocations ADD COLUMN size_name VARCHAR(120) NULL AFTER packaging_size_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'distributor_order_batch_allocations'
    AND column_name = 'size_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE distributor_order_batch_allocations ADD COLUMN volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'distributor_order_batch_allocations'
    AND column_name = 'volume_liters'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE retail_sale_batch_allocations ADD COLUMN packaging_size_id BIGINT UNSIGNED NULL AFTER source_batch_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'retail_sale_batch_allocations'
    AND column_name = 'packaging_size_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE retail_sale_batch_allocations ADD COLUMN size_name VARCHAR(120) NULL AFTER packaging_size_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'retail_sale_batch_allocations'
    AND column_name = 'size_name'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE retail_sale_batch_allocations ADD COLUMN volume_liters DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER size_name',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'retail_sale_batch_allocations'
    AND column_name = 'volume_liters'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
