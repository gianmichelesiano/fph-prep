# FPH Prep

A web application for preparing for the Swiss Federal Pharmacist Exam (FPH Offizin). Features realistic simulations, progress tracking, multi-language support, and a full admin console.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS (Material Design 3 tokens)
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **i18n**: react-i18next — supports Italian, German, French, English
- **Routing**: React Router v7

## Features

- Exam simulations with multiple-choice and K-PRIM (true/false) question types
- 9 subject areas covering the full FPH Offizin curriculum
- Per-user progress tracking (in-progress, completed, score)
- Statistics dashboard with performance trends and weak-topic analysis
- Premium access via Stripe payments
- Multi-language UI (IT / DE / FR / EN)
- Admin console for managing questions, simulations, and users

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/        # Shared UI components (UserLayout, AdminLayout, ...)
│   └── admin/
├── contexts/          # React contexts (AuthContext)
├── data/              # Static data (AREAS)
├── hooks/             # Custom hooks (useProgress)
├── lib/               # Supabase client, API helpers, i18n config
├── locales/           # Translation files (it, de, fr, en)
├── pages/             # Route-level pages
│   └── admin/
└── utils/             # Utility functions (access control, ...)
```

## Admin Access

Set `is_admin = true` on the user's row in the `profiles` table, then navigate to `/admin`.

```sql
UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';
```

## License

Private — all rights reserved.
