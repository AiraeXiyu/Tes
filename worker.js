export default {
  async fetch(request) {
    const target = "https://generator.email/";

    const started = Date.now();

    try {
      const response = await fetch(target, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const elapsed = Date.now() - started;

      const body = await response.text();

      return Response.json({
        success: true,
        target,
        status: response.status,
        statusText: response.statusText,
        elapsed_ms: elapsed,

        headers: {
          location: response.headers.get("location"),
          server: response.headers.get("server"),
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        },

        body_length: body.length,

        body_preview: body.slice(0, 500),
      });
    } catch (error) {
      return Response.json(
        {
          success: false,
          target,
          elapsed_ms: Date.now() - started,
          error: error?.message || String(error),
          error_name: error?.name || null,
        },
        {
          status: 500,
        }
      );
    }
  },
};
