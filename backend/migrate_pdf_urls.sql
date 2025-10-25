-- Migrate old S3 URLs to new API path format
-- Old format: https://trucking-tms-uploads-1759878269.s3.us-east-1.amazonaws.com/abc123.pdf
-- New format: /api/v1/uploads/s3/abc123.pdf

-- Update pod_url
UPDATE loads
SET pod_url = CONCAT('/api/v1/uploads/s3/', SUBSTRING(pod_url FROM '[^/]+$'))
WHERE pod_url LIKE '%s3.amazonaws.com%';

-- Update ratecon_url
UPDATE loads
SET ratecon_url = CONCAT('/api/v1/uploads/s3/', SUBSTRING(ratecon_url FROM '[^/]+$'))
WHERE ratecon_url LIKE '%s3.amazonaws.com%';

-- Show results
SELECT
    COUNT(*) FILTER (WHERE pod_url LIKE '/api/v1/uploads/s3/%') as migrated_pod_urls,
    COUNT(*) FILTER (WHERE ratecon_url LIKE '/api/v1/uploads/s3/%') as migrated_ratecon_urls,
    COUNT(*) FILTER (WHERE pod_url LIKE '%s3.amazonaws.com%') as remaining_old_pod_urls,
    COUNT(*) FILTER (WHERE ratecon_url LIKE '%s3.amazonaws.com%') as remaining_old_ratecon_urls
FROM loads;
