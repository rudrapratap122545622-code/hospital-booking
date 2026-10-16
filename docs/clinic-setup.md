# Clinic onboarding checklist

One Supabase project + one deployment per clinic.

## 1. Supabase project

1. Create a new Supabase project (region: Mumbai for India).
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Run the permissions addendum (the `alter table clinic_staff` block).
4. Note the Project URL, anon key, and service_role key.

## 2. First owner account

1. Supabase → Authentication → Users → **Add user**
   - Email: the clinic owner's email
   - Password: something they'll remember
   - Check **Auto Confirm User**
2. Table Editor → **clinics** → **Insert row**
   - Fill name, timezone, opening_hours (`{}` is fine initially)
   - Save and copy the row's `id`
3. Table Editor → **clinic_staff** → **Insert row**
   - `user_id`: the new user's UID (from Authentication → Users)
   - `clinic_id`: the clinic id from step 2
   - `role`: `owner`
   - `permissions`: `['reception','appointments','doctor','settings']`
   - Save

## 3. Deploy

1. Vercel → New Project → import the ClinicFlow repo.
2. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy.

## 4. Login as owner → do everything else in the app

Once the owner signs in:
- **Settings → Doctors**: add doctors, set their shifts.
- **Settings → Staff**: create logins for receptionists and doctors.
  - Pick the pages each one can access.
  - For doctor logins, pick which doctor row they map to.

Staff sign in at `https://<clinic>.vercel.app/login`.

## 5. Patient-facing URLs

- Booking: `https://<clinic>.vercel.app/book`
- Live queue: `https://<clinic>.vercel.app/queue`

Share the booking URL with the clinic. The queue URL can go on a QR code at reception.