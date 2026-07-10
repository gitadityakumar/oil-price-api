-- Apply fail-closed source governance after source seed rows exist.

update source_catalog
   set commercial_use_allowed = null,
       ingestion_enabled = false,
       public_display_enabled = false,
       rights_status = 'pending',
       canonical_url = case source_key
         when 'ppac_rsp' then 'https://ppac.gov.in/retail-selling-price-rsp-of-petrol-diesel-and-domestic-lpg/price-build-up-of-petrol-and-diesel'
         when 'iocl_retail' then 'https://iocl.com/petrol-diesel-price'
         when 'bpcl_retail' then 'https://www.bharatpetroleum.in/our-businesses/fuels-and-services/petro-prices'
         when 'hpcl_retail' then 'https://www.hindustanpetroleum.com/pricebuildup'
         when 'igl_prices' then 'https://www.iglonline.net/cng-png-prices'
         when 'gujarat_gas_prices' then 'https://www.gujaratgas.com/check-gas-price/'
         when 'mgl_prices' then 'https://www.mahanagargas.com/cng/customer-zone/cng-rate-card'
         when 'mngl_prices' then 'https://www.mngl.in/our-services/check-rates'
         when 'cugl_prices' then 'https://www.cugl.co.in/our-business/CNG/price'
         else canonical_url
       end,
       allowed_hosts = case source_key
         when 'ppac_rsp' then array['ppac.gov.in']
         when 'iocl_retail' then array['iocl.com', 'www.iocl.com']
         when 'bpcl_retail' then array['bharatpetroleum.in', 'www.bharatpetroleum.in']
         when 'hpcl_retail' then array['hindustanpetroleum.com', 'www.hindustanpetroleum.com']
         when 'igl_prices' then array['iglonline.net', 'www.iglonline.net']
         when 'gujarat_gas_prices' then array['gujaratgas.com', 'www.gujaratgas.com']
         when 'mgl_prices' then array['mahanagargas.com', 'www.mahanagargas.com']
         when 'mngl_prices' then array['mngl.in', 'www.mngl.in']
         when 'cugl_prices' then array['cugl.co.in', 'www.cugl.co.in']
         else allowed_hosts
       end;

update source_catalog
   set commercial_use_allowed = false,
       rights_status = 'restricted',
       public_display_enabled = false,
       ingestion_enabled = false
 where source_key in ('pngrb_reference', 'ppac_tax_reference', 'igx_wholesale_context');
