<template>
  <div data-testid="app-shell">
    <header style="border-bottom: 1px solid rgba(127, 127, 127, 0.4)">
      <nav aria-label="Primary" style="max-width: 52rem; margin: 0 auto; padding: 0.85rem 1rem; display: flex; gap: 1.25rem; align-items: center">
        <NuxtLink style="font-weight: 600" to="/">
          Healthy Admin
        </NuxtLink>

        <span aria-hidden="true" style="opacity: 0.45">•</span>
        <span style="opacity: 0.85"> Meals product — planned </span>

        <span aria-hidden="true" style="opacity: 0.45">•</span>
        <span style="opacity: 0.85"> Workouts product — planned </span>
      </nav>
    </header>

    <main style="max-width: 52rem; margin: 0 auto; padding: 1.25rem 1rem">
      <slot />
    </main>

    <footer style="opacity: 0.75; padding: 1.25rem 1rem">
      <div style="max-width: 52rem; margin: 0 auto; font-size: 0.9rem">
        Self-host scaffold only — no dashboards, integrations, persistence, authentication, or data layer yet.
      </div>
    </footer>
  </div>
</template>
