export function getStudioPageHtml(args: { serverUrl: string }): string {
  const { serverUrl } = args

  return `<!DOCTYPE html>
<html lang="en" style="height: 100%;">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="${serverUrl}/dist/ui/index.css">
  <style>
    body {
      margin: 0;
      padding: 0;
      height: 100%;
      color: black;
    }
    #root {
      height: 100%;
    }
  </style>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@18?dev",
      "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime?dev",
      "react-dom": "https://esm.sh/react-dom@18?dev",
      "react-dom/client": "https://esm.sh/react-dom@18/client?dev"
    }
  }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import ReactDOMClient from 'react-dom/client';
    import { Studio } from '${serverUrl}/dist/ui/index.js';
    import { createStudioBFFClient } from "${serverUrl}/dist/data/bff/index.js";
    import { createPostgresAdapter } from "${serverUrl}/dist/data/postgres-core/index.js";

    // TODO: In the future we should have a createUniversalAdapter
    const adapter = createPostgresAdapter({
      executor: createStudioBFFClient({
        customPayload: {},
        url: "${serverUrl}/bff"
      }),
      noParameters: true
    });

    const onEvent = (event) => {
      fetch('${serverUrl}/telemetry', {
        body: JSON.stringify(event),
        method: 'POST',
      });
    };

    window.__PVCE__ = true;
    const container = document.getElementById('root');
    const root = ReactDOMClient.createRoot(container);
    root.render(React.createElement(Studio, { adapter, onEvent }));

    // forces vscode to allow following links when clicked
    document.body.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (link) {
        event.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          window.location.href = href;
        }
      }
    });
  </script>
</body>
</html>`
}
