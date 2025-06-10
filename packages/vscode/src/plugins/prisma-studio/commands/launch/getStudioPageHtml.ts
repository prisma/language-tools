export function getAppRootHtml(args: { serverUrl: string }): string {
  const { serverUrl } = args

  return `<!DOCTYPE html>
<html lang="en" style="height: 100%;">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      height: 100%;
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
    import { Studio } from './dist/ui/index.js';
    import { createStudioBFFClient } from "./dist/data/bff/index.js";
    import { createPostgresAdapter } from "./dist/data/postgres-core/index.js";

    // TODO: In the future we should have a createUniversalAdapter
    const adapter = createPostgresAdapter({
      executor: createStudioBFFClient({
        customPayload: {},
        url: "${serverUrl}/bff"
      })
    });

    const container = document.getElementById('root');
    const root = ReactDOMClient.createRoot(container);
    root.render(React.createElement(Studio, { adapter }));
  </script>
  <link rel="stylesheet" href="${serverUrl}/dist/ui/index.css">
</body>
</html>`
}

export function getWebviewHtml(serverUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <style>
    body, html { 
        margin: 0; 
        padding: 0; 
        height: 100%; 
        overflow: hidden; 
    }
    iframe { 
        width: 100%; 
        height: 100%; 
        border: none; 
    }
  </style>
</head>
<body>
  <iframe src="${serverUrl}"></iframe>
</body>
</html>`
}
