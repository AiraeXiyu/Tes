function getInputValue(html, id) {
  const tag = html.match(
    new RegExp(`<input\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i")
  )?.[0];

  if (!tag) return null;

  return tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] || null;
}

export default {
  async fetch() {
    const started = Date.now();

    try {
      const res = await fetch("https://generator.email/", {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = await res.text();

      const user =
        getInputValue(html, "userName") ||
        html.match(/cur_user\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      const domain =
        getInputValue(html, "domainName2") ||
        html.match(/cur_domain\s*:\s*"([^"]+)"/i)?.[1] ||
        null;

      const numMessRaw =
        html.match(/num_mess\s*:\s*(\d+)/i)?.[1];

      return Response.json({
        success: res.ok,
        status: res.status,

        mailbox: {
          user,
          domain,
          email: user && domain ? `${user}@${domain}` : null,
        },

        inbox: {
          message_count:
            numMessRaw !== undefined
              ? Number(numMessRaw)
              : null,
        },

        elapsed_ms: Date.now() - started,
      });

    } catch (error) {
      return Response.json(
        {
          success: false,
          error: error?.message || String(error),
          elapsed_ms: Date.now() - started,
        },
        { status: 500 }
      );
    }
  },
};
