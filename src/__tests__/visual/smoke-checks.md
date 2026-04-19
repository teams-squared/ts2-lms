# Visual Smoke Tests — Claude in Chrome

Run these checks against `learn.teamsquared.io` using Claude in Chrome MCP tools.

## Login Page (`/login`)

- [ ] Page loads without console errors
- [ ] Logo and "Welcome back" heading visible
- [ ] "Sign in to access your learning platform" subtext visible
- [ ] Microsoft sign-in button present (blue, with MS logo)
- [ ] Email/password form present (in non-production)
- [ ] Demo account hint box visible (in non-production)
- [ ] Dark mode toggle works (page re-renders with dark background)

## Auth Flow (credential login)

- [ ] Fill admin@teamssquared.com / admin123 → redirected to home
- [ ] NavBar visible with logo, Home link, Admin link, user avatar
- [ ] User name "Admin" visible in nav

## Home Page (`/`)

- [ ] "Welcome back, Admin" heading visible
- [ ] Role badge shows "admin"
- [ ] "My Profile" card visible with correct description
- [ ] "Admin Dashboard" card visible (admin-only)

## Profile Page (`/profile`)

- [ ] Large avatar initial rendered
- [ ] Name, email, role badge displayed
- [ ] "Account created" and "Last updated" dates visible and formatted
- [ ] No console errors

## Admin Page (`/admin`)

- [ ] Stats cards rendered (Total Users, Admins, Managers, Employees) with non-zero numbers
- [ ] User table rendered with rows
- [ ] Role dropdown present for each user
- [ ] Changing a role via dropdown updates without page reload

## Sign Out

- [ ] Click user menu → Sign out → returns to login page
- [ ] Navigating to `/profile` after sign-out redirects to `/login`

## Responsive / Mobile

- [ ] Resize to mobile width → hamburger menu appears
- [ ] Desktop nav links hidden, hamburger opens mobile menu

---

## Execution

Use the following MCP tools in sequence:

1. `mcp__Claude_in_Chrome__navigate` — visit pages
2. `mcp__Claude_in_Chrome__read_page` — verify text content
3. `mcp__Claude_in_Chrome__read_console_messages` — catch JS errors
4. `mcp__Claude_in_Chrome__form_input` + `mcp__Claude_in_Chrome__computer` — interactions
5. Compare observed content against expectations above
6. Report mismatches with screenshots via `mcp__Claude_in_Chrome__upload_image`
