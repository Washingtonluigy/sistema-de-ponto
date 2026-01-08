/*
  # Create Storage Bucket for Employee Photos

  1. Storage
    - Create 'employee-photos' bucket for storing employee profile photos
    - Make bucket public for easy access
    - Set up RLS policies for uploads

  2. Security
    - Only authenticated users can upload
    - Public read access for all
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Allow public to view photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'employee-photos');

CREATE POLICY "Allow authenticated users to update their photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employee-photos')
  WITH CHECK (bucket_id = 'employee-photos');

CREATE POLICY "Allow authenticated users to delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'employee-photos');
