import { ExtensionContext, ViewColumn, window, Uri } from 'vscode'
import { PrismaVSCodePlugin } from '../types'
import http from 'http'
import * as fs from 'fs'
import * as path from 'path'

const studio: PrismaVSCodePlugin = {
  name: 'Studio',
  enabled: () => true,
  activate: (context: ExtensionContext) => {
    const staticFilesRoot = Uri.joinPath(context.extensionUri, 'node_modules', '@prisma', 'studio-core')

    const panel = window.createWebviewPanel('studio', 'Studio', ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [staticFilesRoot],
    })

    const server = http.createServer((req, res) => {
      console.log('PATH', staticFilesRoot)

      if (req.url !== undefined && req.url !== '/') {
        let contentType = ''
        const filePath = path.join(staticFilesRoot.path, req.url)
        const fileExt = path.extname(filePath).toLowerCase()
        if (fileExt === '.css') contentType = 'text/css'
        else if (fileExt === '.js' || fileExt === '.mjs') contentType = 'application/javascript'
        else if (fileExt === '.html' || fileExt === '.htm') contentType = 'text/html'
        else if (fileExt === '.json') contentType = 'application/json'
        else if (fileExt === '.png') contentType = 'image/png'
        else if (fileExt === '.jpg' || fileExt === '.jpeg') contentType = 'image/jpeg'
        else if (fileExt === '.gif') contentType = 'image/gif'
        else if (fileExt === '.svg') contentType = 'image/svg+xml'

        // TODO better error handling with proper 404 responses
        res.writeHead(200, { 'Content-Type': contentType })
        fs.createReadStream(filePath).pipe(res)
      } else {
        // TODO move this to a template
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<!DOCTYPE html>
<html lang="en" style="height: 100%;">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="./dist/ui/index.css">
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
      "react-dom/client": "https://esm.sh/react-dom@18/client?dev",
      "@electric-sql/pglite": "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js"
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
    import { createPGLiteAdapter } from "./dist/data/pglite/index.js";
    import { PGlite, types } from "@electric-sql/pglite";

    const pglite = new PGlite({
      parsers: {
        [types.DATE]: (v) => v,
        [types.INTERVAL]: (v) => v,
        [types.RELTIME]: (v) => v,
        [types.TIME]: (v) => v,
        [types.TIMESTAMP]: (v) => v,
        [types.TIMESTAMPTZ]: (v) => v,
        [types.TIMETZ]: (v) => v,
        [types.TINTERVAL]: (v) => v,
      },
    });

    await pglite.exec(\`
      SET TIME ZONE 'America/New_York';
      
      create table if not exists "public"."info" (
        "id" serial primary key,
        "name" text,
        "email" text,
        "name_email" text GENERATED ALWAYS AS (("name" || ' <' || "email" || '>')) STORED
      );

      create table if not exists "public"."dates" (
        "id" serial primary key,
        "date_col" date default (CURRENT_DATE + (RANDOM() * (INTERVAL '30 days'))),
        "interval_col" interval default (CEIL(RANDOM() * 25) * (INTERVAL '30 days')),
        "time_col" time default (CURRENT_TIME + (RANDOM() * (INTERVAL '1 hour'))),
        "timetz_col" timetz default (CURRENT_TIME + (RANDOM() * (INTERVAL '1 hour'))),
        "timestamp_col" timestamp default (CURRENT_TIMESTAMP + (RANDOM() * (INTERVAL '1 days'))),
        "timestamptz_col" timestamptz default (CURRENT_TIMESTAMP + (RANDOM() * (INTERVAL '1 days')))
      );
      insert into "public"."dates" (id)
      select generate_series(1, 10);

      create table if not exists "public"."numbers" (
        "id" serial primary key,
        "integer_col" integer,
        "smallint_col" smallint,
        "bigint_col" bigint,
        "decimal_col" decimal(10,2),
        "numeric_col" numeric(10,4),
        "real_col" real,
        "double_col" double precision,
        "nullable_int" integer
      );
      insert into "public"."numbers" ("integer_col", "smallint_col", "bigint_col", "decimal_col", "numeric_col", "real_col", "double_col", "nullable_int")
      select 
        (random() * 1000)::integer, 
        (random() * 100)::smallint, 
        (random() * 10000)::bigint, 
        (random() * 1000)::decimal(10,2), 
        (random() * 100)::numeric(10,4), 
        random()::real * 10, 
        random() * 100, 
        CASE WHEN i % 2 = 0 THEN (random() * 500)::integer ELSE NULL END
      from generate_series(1, 20) as s(i);

      create table if not exists "public"."json" (
        "id" serial primary key,
        "json_col" json,
        "jsonb_col" jsonb
      );
      insert into "public"."json" ("json_col", "jsonb_col")
      values
        ('{"hello":"world"}', '{"numbers":[1,2,3]}'::jsonb),
        ('{"flag":true}', '{"flag":false}'::jsonb);

      create table if not exists "public"."lists" (
        "id" serial primary key,
        "integer_list" integer[] not null,
        "text_list" text[],
        "boolean_list" boolean[] not null
      );
      insert into "public"."lists" ("integer_list", "text_list", "boolean_list")
      values
        (ARRAY[1, 2, 3], ARRAY['apple', 'banana', 'cherry'], ARRAY[true, false, true]),
        (ARRAY[10, 20], NULL, ARRAY[false, false]),
        (ARRAY[100], ARRAY['single'], ARRAY[true]);

      create type "public"."role" as enum ('admin', 'maintainer', 'member', 'moderator', 'contributor', 'viewer', 'editor', 'guest', 'supervisor', 'developer');

      create table if not exists "public"."logs" (
        "message" text,
        "created_at" timestamp default now(),
        "level" "public"."role", -- Reusing the existing role enum
        "processed" boolean default false,
        "details" json,
        "value" numeric(8, 2)
      );
      insert into "public"."logs" ("message", "level", "processed", "details", "value")
      values
        ('Initial log entry', 'admin', true, '{"source": "system"}', 123.45),
        ('User action recorded', 'member', false, '{"user_id": 10, "action": "login"}', 0.00),
        ('Maintenance task started', 'maintainer', false, null, null);

      create schema if not exists "zoo";
      create table if not exists "zoo"."animals" ("id" serial primary key, "name" text);
      insert into "zoo"."animals" DEFAULT VALUES;
      insert into "zoo"."animals" DEFAULT VALUES;
      insert into "zoo"."animals" DEFAULT VALUES;
      
      create table if not exists "public"."users" ("id" serial primary key, "created_at" timestamp default now(), "activated" boolean default false, "role" role);
      insert into "public"."users" ("created_at", "activated", "role")
      select NOW() + (i * INTERVAL '1 millisecond'), (i % 2 = 0), (ARRAY['admin', 'maintainer', 'member', 'moderator', 'contributor', 'viewer', 'editor', 'guest', 'supervisor', 'developer'])[floor(random() * 10 + 1)]::role from generate_series(1, 200) as s(i);

      create table if not exists "public"."posts" ("id" serial primary key, "created_at" timestamp default now(), "user_id" integer not null references "public"."users"("id"), "content" text not null);
      insert into "public"."posts" ("user_id", "content") values (1, 'Hello world!');
    \`)

    const adapter = createPGLiteAdapter(pglite, { logging: true });

    const container = document.getElementById('root');
    const root = ReactDOMClient.createRoot(container); // Create a root.
    root.render(React.createElement(Studio, { adapter })); // Initial render
  </script>
</body>
</html>`)
        return
      }
    })

    // TODO choose better port
    server.listen(3000, () => {
      console.log('Server is running at http://localhost:3000')
    })

    // TODO move this to a template
    const serverUrl = 'http://localhost:3000'
    panel.webview.html = `<!DOCTYPE html>
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
  },
  deactivate: async () => {},
}

export default studio
