import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { syncArticleToGitHub } from "sync";

export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext,
) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }), headers };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GITHUB_TOKEN not configured" }),
      headers,
    };
  }

  let body: { path?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }), headers };
  }

  const path = body.path?.trim();
  if (!path) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing path in body" }), headers };
  }

  const owner = process.env.GITHUB_OWNER ?? "wiki-as-git";
  console.log(`[${new Date().toISOString()}] sync: start path=${path} owner=${owner}`);
  const result = await syncArticleToGitHub(
    path.startsWith("/") ? path : `/${path}`,
    {
      owner,
      token,
      branch: "master",
    },
  );
  console.log(`[${new Date().toISOString()}] sync: done success=${result.success}`);

  return {
    statusCode: result.success ? 200 : 400,
    body: JSON.stringify(result),
    headers,
  };
};
