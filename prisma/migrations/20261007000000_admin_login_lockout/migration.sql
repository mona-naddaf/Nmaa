-- Supervisor login attempt limit: failed supervisor logins are counted in
-- LoginAttempt under their own scope (src/lib/auth/login-lockout.ts).
ALTER TYPE "LoginScope" ADD VALUE 'ADMIN';
