# marvel-web

The website of the Marvel Universe Graph. See the [main README](../README.md) for how to run it.

- `app/api/graph/route.ts` sends the whole graph to the browser.
- `app/api/chat/route.ts` is the agent: question, then Cypher, then FalkorDB, then an answer from the rows only.
- `lib/missions.ts` holds the five ready-made story questions and their Cypher.
- `components/Universe.tsx` is the page: graph view, story, chat.

Deploy: import the repository on [Vercel](https://vercel.com/new), set the root directory to `marvel-web`, and add `FALKORDB_URL` and `LLM_API_KEY` as environment variables.
