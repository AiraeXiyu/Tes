const USER = "h3d4nzk";
const DOMAIN = "laksana.in";

export default {
  async fetch() {
    const started = Date.now();

    try {
      const ctx = encodeURIComponent(`${DOMAIN}/${USER}`);

      const res = await fetch("https://generator.email/inbox7/", {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language": "en-US,en;q=0.9",

          "Cookie": `inbox_ctx=${ctx}`,
        },
      });

      const html = await res.text();

      const curUser =
        html.match(/cur_user\s*:\s*"([^"]*)"/i)?.[1] || null;

      const curDomain =
        html.match(/cur_domain\s*:\s*"([^"]*)"/i)?.[1] || null;

      const numMessRaw =
        html.match(/num_mess\s*:\s*(\d+)/i)?.[1];

      const messId =
        html.match(/mess_id_raw\s*:\s*"([^"]*)"/i)?.[1] || null;

      const hasTest123 = /TEST123/i.test(html);
      const hasHello = /hello/i.test(html);

      return Response.json({
        success: res.ok,
        status: res.status,

        mailbox: {
          user: curUser,
          domain: curDomain,
          email:
            curUser && curDomain
              ? `${curUser}@${curDomain}`
              : null,
        },

        inbox: {
          message_count:
            numMessRaw !== undefined
              ? Number(numMessRaw)
              : null,

          message_id: messId,

          test_subject_found: hasTest123,
          test_body_found: hasHello,
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
