# Navigation Performance Audit (Post-login Tabs)

## Scope
- Target app: `https://hr-web-ten.vercel.app/`
- Intended pages: Dashboard, Requests, Chat, Employees, Departments, Forms, Reports, Settings, Notifications.

## What was executed
1. Automated browser run with Playwright against production URL.
2. Attempted login and then rapid navigation loops (forward/back and tab switching).
3. Captured request/response activity and a screenshot artifact.

## Environment limitation observed
- In this execution environment, browser automation could open the login page but could not complete a valid authenticated navigation session. The final URL remained `/en/login`.
- Auth-related calls observed during run: `/api/auth/csrf`, `/api/auth/me`, `/api/auth/refresh` (repeated), with no successful transition to app routes.

## Live observations from run (limited to unauthenticated session)
- Navigation across requested tabs was not possible because those tabs were not available before successful login.
- API-like calls captured during the run were limited and repeated around auth endpoints.
- A screenshot of the final page (login) was captured by the browser tool.

## Source-code based performance findings (high confidence)

### 1) UX behavior likely to feel "not instant"
- Every major page is a client component that performs fetch-on-mount with `useEffect` and local loading state; this commonly causes visible loading after route changes.
- Several pages render `PageLoader` until auth/data is ready, which can appear as delay during tab switching.

### 2) Data fetching pattern: repeated refetch on each page mount
- Dashboard mount triggers a **large parallel batch** (`/leaves/balances`, `/leaves`, `/permissions`, `/forms/submissions`, `/notes`, `/permissions/cycle`, `/leaves/absence-deductions`, `/settings/work-schedule`, `/lateness`, `/notifications`).
- Requests page refetches `/leaves` and `/permissions` on mount.
- Reports page refetches main report endpoint + `/reports/summary` on mount.
- Chat page fetches `/chat/chats` (or `/chat/employees`) and conversation data when opening chats.

### 3) Polling / background refresh adds steady network pressure
- Dashboard, Requests, Notifications, Reports all set 30s polling intervals (`setInterval(..., 30000)`) when visible.
- This means switching tabs can overlap with periodic refresh bursts.

### 4) Caching is present but effectively opt-in and mostly bypassed
- Axios runtime cache exists with 30s TTL, but it is used only when header `x-allow-cache: 1` is set.
- Most page fetches do not set `x-allow-cache`; many background calls explicitly set `x-no-cache: 1`.
- Net effect: repeated GETs are commonly re-fetched instead of reused.

### 5) No TanStack Query / React Query layer detected
- No `useQuery`, `QueryClient`, `prefetchQuery`, or TanStack Query usage was found in the frontend source.
- So there is no shared stale-time cache, deduplication, automatic prefetch, or route-level hydration cache from TanStack Query.

### 6) Routing/layout structure is generally correct (not full reload routing issue)
- App routes are under shared `(app)` layout and wrapped by `AppShell`, so top nav + tab nav should persist across sibling route navigation.
- This suggests bottleneck is more likely data fetching + loading strategy than Next.js router remounting the entire shell.

## Performance judgment
- **Most likely outcome post-login:** navigation is functional but can feel slower than a well-optimized Next.js app due to repeated page-mount fetching, frequent polling, and minimal effective client caching.
- The architecture is not "wrong", but current data strategy is likely the main cause of perceived non-smooth transitions.

## Prioritized issues (highest impact first)
1. **Heavy per-page refetch on mount** (especially Dashboard) without cross-page cache reuse.
2. **Multiple 30s pollers** across pages causing periodic network spikes.
3. **`useRequireAuth` + page-level loaders** can reintroduce loading gates on navigation.
4. **Cache not consistently enabled** (`x-allow-cache` rarely used).
5. **No prefetch strategy** for likely-next tabs.

## Recommended improvements

### A) Move to shared query cache (TanStack Query)
- Introduce `QueryClientProvider` at app shell level.
- Convert page fetches to `useQuery` with meaningful `staleTime` and `gcTime`.
- Enable `refetchOnWindowFocus` selectively.

```tsx
const dashboardQuery = useQuery({
  queryKey: ['dashboard', userId],
  queryFn: fetchDashboardBundle,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
});
```

### B) Replace full-page polling with targeted invalidation/events
- Keep pusher-driven invalidation for changed resources.
- Poll only when real-time channel unavailable, and at longer intervals (e.g., 60–120s) with backoff.

### C) Split heavy dashboard payload
- Defer non-critical widgets (e.g., less frequently used cards) and render them after first paint.
- Optionally provide one backend aggregate endpoint for above-the-fold data to reduce request fan-out.

### D) Prefetch likely next routes/data
- Use route prefetch and/or query prefetch on hover/idle for top nav tabs.

```tsx
router.prefetch(`/${locale}/requests`);
queryClient.prefetchQuery({ queryKey: ['requests', filters], queryFn: fetchRequests });
```

### E) Reduce loader flicker
- Keep previous data while fetching (`keepPreviousData`) and use lightweight inline skeletons per widget instead of blocking full-page loaders.

## Suggested verification plan (once authenticated session is available)
1. Record baseline in DevTools Performance + Network while switching tabs 20–30 times.
2. Track median and p95 route transition time per tab pair.
3. Compare before/after on:
   - API requests per transition
   - duplicate request ratio
   - JS main-thread blocking time
   - user-visible loading duration.

