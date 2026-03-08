<?php

declare(strict_types=1);

/** @var array<string, mixed> $docsConfig */
/** @var string $requestedVersion */
/** @var string $apiJsonUrl */
/** @var array<string, array<string, string>> $versions */
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars((string) $docsConfig['title'], ENT_QUOTES, 'UTF-8') ?></title>
  <meta name="description" content="<?= htmlspecialchars((string) $docsConfig['description'], ENT_QUOTES, 'UTF-8') ?>">
  <link rel="preconnect" href="https://unpkg.com">
  <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  <style>
    :root {
      --docs-bg: #f8fafc;
      --docs-panel: #ffffff;
      --docs-line: rgba(15, 23, 42, 0.08);
      --docs-text: #1e293b;
      --docs-muted: #64748b;
      --docs-primary: #2563eb;
      --docs-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }

    body[data-theme="dark"] {
      --docs-bg: #0b1120;
      --docs-panel: #0f172a;
      --docs-line: rgba(148, 163, 184, 0.14);
      --docs-text: #e5eefc;
      --docs-muted: #94a3b8;
      --docs-primary: #60a5fa;
      --docs-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
    }

    * {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      min-height: 100%;
      background: var(--docs-bg);
      color: var(--docs-text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .docs-app {
      min-height: 100vh;
    }

    elements-api {
      height: 100vh;
      --color-canvas: var(--docs-bg);
      --color-fill: var(--docs-panel);
      --color-text: var(--docs-text);
      --color-text-paragraph: var(--docs-muted);
      --color-primary: var(--docs-primary);
      --color-link: var(--docs-primary);
      --color-border: var(--docs-line);
      --sidebar-bg: color-mix(in srgb, var(--docs-bg) 88%, #e5e7eb 12%);
      --fs-heading-1: 2rem;
      --fs-heading-2: 1.5rem;
      --fs-heading-3: 1.2rem;
    }

    @media (max-width: 900px) {
    }
  </style>
</head>
<body data-theme="light">
  <div class="docs-app">
    <elements-api
      id="elements-api"
      apiDescriptionUrl="<?= htmlspecialchars($apiJsonUrl, ENT_QUOTES, 'UTF-8') ?>"
      router="hash"
      layout="<?= htmlspecialchars((string) $docsConfig['layout'], ENT_QUOTES, 'UTF-8') ?>"
      tryItCredentialsPolicy="same-origin"></elements-api>
  </div>

  <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
  <script>
    const docsConfig = {
      title: <?= json_encode($docsConfig['title']) ?>,
      description: <?= json_encode($docsConfig['description']) ?>,
      logo: <?= json_encode($docsConfig['logo']) ?>,
      layout: <?= json_encode($docsConfig['layout']) ?>,
      theme: <?= json_encode($docsConfig['theme']) ?>,
      hide_try_it: <?= json_encode($docsConfig['hide_try_it']) ?>,
      hide_schemas: <?= json_encode($docsConfig['hide_schemas']) ?>,
      apiJsonUrl: <?= json_encode($apiJsonUrl) ?>
    };

    const root = document.body;
    const elementsApi = document.getElementById('elements-api');

    const resolveTheme = (theme) => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }

      return theme;
    };

    const applyTheme = (theme) => {
      root.dataset.theme = resolveTheme(theme);
      localStorage.setItem('amsal-docs-theme', theme);
    };

    const storedTheme = localStorage.getItem('amsal-docs-theme') || docsConfig.theme || 'system';
    applyTheme(storedTheme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if ((localStorage.getItem('amsal-docs-theme') || docsConfig.theme) === 'system') {
        applyTheme('system');
      }
    });

    elementsApi.setAttribute('apiDescriptionUrl', docsConfig.apiJsonUrl);
    elementsApi.setAttribute('router', 'hash');
    elementsApi.setAttribute('layout', docsConfig.layout);
    elementsApi.setAttribute('tryItCredentialsPolicy', 'same-origin');
    elementsApi.hideTryIt = docsConfig.hide_try_it;
    elementsApi.hideSchemas = docsConfig.hide_schemas;
    elementsApi.logo = docsConfig.logo;
  </script>
</body>
</html>
