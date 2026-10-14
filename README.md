This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Database migrations

Name each new folder in `prisma/migrations` so it sorts after the last one. The folder already holds future-dated names, so continue that sequence one day at a time (after `20261017000000` comes `20261018000000`, …) until real dates pass the last one, then use real timestamps.

## Development database (Neon branches)

- `.env` points at the **live** database (host `ep-green-haze`). The Prisma CLI reads only `.env`, so pass the dev branch's URL explicitly to every Prisma command run for testing.
- `.env.development.local` points at the dev branch **`calendar-dev-restored`** (host `ep-proud-wind`), which `next dev` uses. Test there first.
- **`calendar-dev`** (host `ep-solitary-voice`) is the parent of `calendar-dev-restored`. Don't use it for testing, and **don't delete it**.
- Never pass any database URL as a Prisma shadow database (`--shadow-database-url`, `shadowDatabaseUrl`): Prisma resets the shadow database and erases its data.

## Branches and pushing

- Work happens on the local branch **`rafiq`**, which stays local only. Don't push it to GitHub as its own branch.
- Push only with `git push origin rafiq:main`. A push to `main` triggers Vercel's production deployment.
- Never run a plain `git push origin rafiq` (or `git push -u`). It creates a remote `rafiq` branch and an extra Vercel preview deployment.

## Pending

- **Next surah after a plan change.** The recitation check (`classifyRecitation` in `src/lib/recitation/logic.ts`) only asks whether the surah just before the entry in the plan is complete. After a plan change, gaps approved under the old plan stop counting, so her position goes back, but a surah whose predecessor she has fully memorized is still accepted as «تقدّم طبيعي» without a reason (e.g. Al-Ḥāqqa 1 after a fully memorized Al-Maʿārij) while her position stays where it was. This predates the juz directions; handle it separately.
- **Morocco offsets.** Verify Morocco offsets in the browser vs server if a Moroccan course is added. The server's time-zone data (UTC+1 all year, UTC+0 during Ramadan) is the source of truth for course days and prayer times, but browsers and some references have disagreed for late 2026 (see `src/lib/prayer/times.test.ts`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
