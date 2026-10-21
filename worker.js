const USER = "h3d4nzk";
const DOMAIN = "laksana.in";
const MESSAGE_ID = "c90f6514c8f3fc59f76662822ce8632e";

export default {
  async fetch() {
    const started = Date.now();

    try {
      const ctx = encodeURIComponent(
        `${DOMAIN}/${USER}/${MESSAGE_ID}`
      );

      const url =
        `https://generator.email/inbox/message?src=${encodeURIComponent(MESSAGE_ID)}`;

      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "en-US,en;q=0.9",

          "Cookie":
            `inbox_ctx=${ctx}`,
        },
      });

      const body = await res.text();

      return Response.json({
        success: res.ok,

        status: res.status,

        url,

        content_type:
          res.headers.get("content-type"),

        body_length: body.length,

        body_preview:
          body.slice(0, 12000),

        elapsed_ms:
          Date.now() - started,
      });

    } catch (error) {
      return Response.json(
        {
          success: false,

          error:
            error?.message ||
            String(error),

          error_name:
            error?.name ||
            null,

          elapsed_ms:
            Date.now() - started,
        },
        {
          status: 500,
        }
      );
    }
  },
};
