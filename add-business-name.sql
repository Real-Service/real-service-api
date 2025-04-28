-- Check if business_name column exists first
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'contractor_profiles' 
        AND column_name = 'business_name'
    ) THEN
        -- Add the business_name column if it doesn't exist
        ALTER TABLE contractor_profiles ADD COLUMN business_name TEXT;
        RAISE NOTICE 'Added business_name column to contractor_profiles table';
    ELSE
        RAISE NOTICE 'business_name column already exists in contractor_profiles table';
    END IF;
END $$;