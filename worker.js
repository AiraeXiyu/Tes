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

          "Accept-Language":
            "en-US,en;q=0.9",

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

      const messageId =
        html.match(/mess_id_raw\s*:\s*"([^"]*)"/i)?.[1] || null;

      const curMsgId =
        html.match(/cur_msg_id\s*:\s*"([^"]*)"/i)?.[1] || null;


      // Cari semua kemunculan message ID
      const occurrences = [];

      if (messageId) {
        let pos = 0;

        while (true) {
          const found = html.indexOf(messageId, pos);

          if (found === -1) {
            break;
          }

          occurrences.push({
            position: found,

            context: html.slice(
              Math.max(0, found - 1500),
              Math.min(
                html.length,
                found + messageId.length + 3500
              )
            ),
          });

          pos = found + messageId.length;

          if (occurrences.length >= 10) {
            break;
          }
        }
      }


      // Cari URL yang berhubungan dengan message/inbox
      const interestingUrls = [
        ...html.matchAll(
          /(?:https?:\/\/[^\s"'<>]+|\/[A-Za-z0-9_./?=&%-]+)/gi
        ),
      ]
        .map((m) => m[0])
        .filter((v) =>
          /message|mail|inbox|read|detail|view|api|ajax|php/i.test(v)
        );


      // Cari baris yang berhubungan dengan message
      const interestingLines = html
        .split(/\r?\n/)
        .filter((line) =>
          /mess_id_raw|cur_msg_id|messageId|message_id|load.*message|read.*message|message.*detail|fetch\(|ajax|XMLHttpRequest|\/message|\/mail/i.test(
            line
          )
        )
        .slice(0, 100);


      // Cari semua file JavaScript
      const scripts = [
        ...html.matchAll(
          /<script[^>]+src=["']([^"']+)["']/gi
        ),
      ].map((m) => m[1]);


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

          message_id: messageId,

          cur_msg_id: curMsgId,
        },

        diagnostics: {
          html_length: html.length,

          message_id_occurrences:
            occurrences.length,

          occurrences: occurrences,

          interesting_urls: [
            ...new Set(interestingUrls),
          ].slice(0, 100),

          interesting_lines: interestingLines,

          scripts: scripts,
        },

        elapsed_ms: Date.now() - started,
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
