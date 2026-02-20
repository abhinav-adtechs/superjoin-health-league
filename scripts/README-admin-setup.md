# Admin User Setup

The admin user (`abhinav@superjoin.ai`) can use either email/password or PIN login. Scripts read credentials from `.env.local` or `scripts/.env.local`.

## PIN Login (profile_auth table)

Before creating users with PINs, run the PIN migration once (creates `profile_auth` table):

```bash
# If you get SSL certificate errors, run with:
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run run-pin-migration
```

## Option 1: Using the Script (Recommended)

This script creates both the auth user and profile automatically:

```bash
# Set your environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export ADMIN_PASSWORD="your-secure-password"

# Run the script
npm run create-admin
```

Or in one line:
```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... npm run create-admin
```

The script will:
1. Check if the auth user exists (create if not)
2. Set/update the password
3. Create or update the profile with `is_admin = true`

## Option 2: Using SQL Only

If you prefer to use SQL:

1. **Create the auth user** via Supabase Dashboard:
   - Go to **Authentication > Users > Add User**
   - Email: `abhinav@superjoin.ai`
   - Password: [your password]
   - **Auto-confirm email**: Yes (important!)
   - Click "Create user"
   - Copy the User ID (UUID)

2. **Run the SQL** in `supabase/create-admin.sql`:
   - The SQL will automatically find the user by email and create the profile
   - Or replace `USER_ID_HERE` with the UUID you copied

## Verify Admin Setup

After setup, verify:

```sql
SELECT 
  p.id,
  p.display_name,
  p.is_admin,
  au.email,
  au.email_confirmed_at IS NOT NULL as email_confirmed
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'abhinav@superjoin.ai';
```

You should see:
- `is_admin = true`
- `email_confirmed = true`

## Troubleshooting

**Loading state stuck?**
- Check browser console for errors
- Check Network tab for failed API calls
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set in your `.env` file
- Verify admin profile exists: `SELECT * FROM profiles WHERE is_admin = true;`

**Can't log in?**
- Verify auth user exists: Check Supabase Dashboard > Authentication > Users
- Verify email is confirmed (should be auto-confirmed)
- Try resetting password via Supabase Dashboard
